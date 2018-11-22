import { Map } from 'immutable';

import * as E from '../expressions';
import * as C from '../util/Consts';
import * as Err from '../util/Errors';

import { Bindings } from '../Types';
import { bool } from './Helpers';
import { regularFunctions, specialFunctions } from './index';

type Term = E.TermExpression;
type PTerm = Promise<E.TermExpression>;

function _bound({ args, mapping }: { args: E.Expression[], mapping: Bindings }) {
  const variable = args[0] as E.VariableExpression;
  if (variable.expressionType !== E.ExpressionType.Variable) {
    throw new Err.InvalidArgumentTypes(args, C.SpecialOperator.BOUND);
  }
  const val = mapping.has(variable.name) && !!mapping.get(variable.name);
  return bool(val);
}

// BOUND ----------------------------------------------------------------------
const bound = {
  arity: 1,
  async applyAsync({ args, mapping }: E.EvalContextAsync): PTerm {
    return _bound({ args, mapping });
  },
  applySync({ args, mapping }: E.EvalContextSync): Term {
    return _bound({ args, mapping });
  },
};

// IF -------------------------------------------------------------------------
const ifSPARQL = {
  arity: 3,
  async applyAsync({ args, mapping, evaluate }: E.EvalContextAsync): PTerm {
    const valFirst = await evaluate(args[0], mapping);
    const ebv = valFirst.coerceEBV();
    return (ebv)
      ? evaluate(args[1], mapping)
      : evaluate(args[2], mapping);
  },
  applySync({ args, mapping, evaluate }: E.EvalContextSync): Term {
    const valFirst = evaluate(args[0], mapping);
    const ebv = valFirst.coerceEBV();
    return (ebv)
      ? evaluate(args[1], mapping)
      : evaluate(args[2], mapping);
  },
};

// COALESCE -------------------------------------------------------------------
const coalesce = {
  arity: Infinity,
  async applyAsync({ args, mapping, evaluate }: E.EvalContextAsync): PTerm {
    const errors: Error[] = [];
    for (const expr of args) {
      try {
        return await evaluate(expr, mapping);
      } catch (err) {
        errors.push(err);
      }
    }
    throw new Err.CoalesceError(errors);
  },
  applySync({ args, mapping, evaluate }: E.EvalContextSync): Term {
    const errors: Error[] = [];
    for (const expr of args) {
      try {
        return evaluate(expr, mapping);
      } catch (err) {
        errors.push(err);
      }
    }
    throw new Err.CoalesceError(errors);
  },
};

// logical-or (||) ------------------------------------------------------------
// https://www.w3.org/TR/sparql11-query/#func-logical-or
const logicalOr = {
  arity: 2,
  async applyAsync({ args, mapping, evaluate }: E.EvalContextAsync): PTerm {
    const [leftExpr, rightExpr] = args;
    try {
      const leftTerm = await evaluate(leftExpr, mapping);
      const left = leftTerm.coerceEBV();
      if (left) { return bool(true); }
      const rightTerm = await evaluate(rightExpr, mapping);
      const right = rightTerm.coerceEBV();
      return bool(right);
    } catch (leftErr) {
      const rightTerm = await evaluate(rightExpr, mapping);
      const right = rightTerm.coerceEBV();
      if (!right) { throw leftErr; }
      return bool(true);
    }
  },
  applySync({ args, mapping, evaluate }: E.EvalContextSync): Term {
    const [leftExpr, rightExpr] = args;
    try {
      const leftTerm = evaluate(leftExpr, mapping);
      const left = leftTerm.coerceEBV();
      if (left) { return bool(true); }
      const rightTerm = evaluate(rightExpr, mapping);
      const right = rightTerm.coerceEBV();
      return bool(right);
    } catch (leftErr) {
      const rightTerm = evaluate(rightExpr, mapping);
      const right = rightTerm.coerceEBV();
      if (!right) { throw leftErr; }
      return bool(true);
    }
  },
};

// logical-and (&&) -----------------------------------------------------------
// https://www.w3.org/TR/sparql11-query/#func-logical-and
const logicalAnd = {
  arity: 2,
  async applyAsync({ args, mapping, evaluate }: E.EvalContextAsync): PTerm {
    const [leftExpr, rightExpr] = args;
    try {
      const leftTerm = await evaluate(leftExpr, mapping);
      const left = leftTerm.coerceEBV();
      if (!left) { return bool(false); }
      const rightTerm = await evaluate(rightExpr, mapping);
      const right = rightTerm.coerceEBV();
      return bool(right);
    } catch (leftErr) {
      const rightTerm = await evaluate(rightExpr, mapping);
      const right = rightTerm.coerceEBV();
      if (right) { throw leftErr; }
      return bool(false);
    }
  },
  applySync({ args, mapping, evaluate }: E.EvalContextSync): Term {
    const [leftExpr, rightExpr] = args;
    try {
      const leftTerm = evaluate(leftExpr, mapping);
      const left = leftTerm.coerceEBV();
      if (!left) { return bool(false); }
      const rightTerm = evaluate(rightExpr, mapping);
      const right = rightTerm.coerceEBV();
      return bool(right);
    } catch (leftErr) {
      const rightTerm = evaluate(rightExpr, mapping);
      const right = rightTerm.coerceEBV();
      if (right) { throw leftErr; }
      return bool(false);
    }
  },
};

// sameTerm -------------------------------------------------------------------
const sameTerm = {
  arity: 2,
  async applyAsync({ args, mapping, evaluate }: E.EvalContextAsync): PTerm {
    if (args.length !== 2) { throw new Err.InvalidArity(args, C.SpecialOperator.SAME_TERM); }
    const [leftExpr, rightExpr] = args.map((a) => evaluate(a, mapping));
    const left = await leftExpr;
    const right = await rightExpr;
    return bool(left.toRDF().equals(right.toRDF()));
  },
  applySync({ args, mapping, evaluate }: E.EvalContextSync): Term {
    if (args.length !== 2) { throw new Err.InvalidArity(args, C.SpecialOperator.SAME_TERM); }
    const [left, right] = args.map((a) => evaluate(a, mapping));
    return bool(left.toRDF().equals(right.toRDF()));
  },
};

// IN -------------------------------------------------------------------------
const inSPARQL = {
  arity: Infinity,
  async applyAsync({ args, mapping, evaluate }: E.EvalContextAsync): PTerm {
    if (args.length < 1) { throw new Err.InvalidArity(args, C.SpecialOperator.IN); }
    const [leftExpr, ...remaining] = args;
    const left = await evaluate(leftExpr, mapping);
    return inRecursiveAsync(left, { args: remaining, mapping, evaluate }, []);
  },
  applySync({ args, mapping, evaluate }: E.EvalContextSync): Term {
    if (args.length < 1) { throw new Err.InvalidArity(args, C.SpecialOperator.IN); }
    const [leftExpr, ...remaining] = args;
    const left = evaluate(leftExpr, mapping);
    return inRecursiveSync(left, { args: remaining, mapping, evaluate }, []);
  },
};

async function inRecursiveAsync(
  needle: Term,
  { args, mapping, evaluate }: E.EvalContextAsync,
  results: Array<Error | false>,
): PTerm {

  if (args.length === 0) {
    const noErrors = results.every((v) => !v);
    return (noErrors) ? bool(false) : Promise.reject(new Err.InError(results));
  }

  try {
    const next = await evaluate(args.shift(), mapping);
    const isEqual = regularFunctions.get(C.RegularOperator.EQUAL);
    if (isEqual.apply([needle, next])) {
      return bool(true);
    } else {
      inRecursiveAsync(needle, { args, mapping, evaluate }, [...results, false]);
    }
  } catch (err) {
    return inRecursiveAsync(needle, { args, mapping, evaluate }, [...results, err]);
  }
}

function inRecursiveSync(
  needle: Term,
  { args, mapping, evaluate }: E.EvalContextSync,
  results: Array<Error | false>,
): Term {

  if (args.length === 0) {
    const noErrors = results.every((v) => !v);
    if (noErrors) {
      bool(false);
    } else {
      throw new Err.InError(results);
    }
  }

  try {
    const next = evaluate(args.shift(), mapping);
    const isEqual = regularFunctions.get(C.RegularOperator.EQUAL);
    if (isEqual.apply([needle, next])) {
      return bool(true);
    } else {
      inRecursiveSync(needle, { args, mapping, evaluate }, [...results, false]);
    }
  } catch (err) {
    return inRecursiveSync(needle, { args, mapping, evaluate }, [...results, err]);
  }
}

// NOT IN ---------------------------------------------------------------------
const notInSPARQL = {
  arity: Infinity,
  async applyAsync(context: E.EvalContextAsync): PTerm {
    const _in = specialFunctions.get(C.SpecialOperator.IN);
    const isIn = await _in.applyAsync(context);
    return bool(!(isIn as E.BooleanLiteral).typedValue);
  },
  applySync(context: E.EvalContextSync): Term {
    const _in = specialFunctions.get(C.SpecialOperator.IN);
    const isIn = _in.applySync(context);
    return bool(!(isIn as E.BooleanLiteral).typedValue);
  },
};

// ----------------------------------------------------------------------------
// Wrap these declarations into functions
// ----------------------------------------------------------------------------

export type SpecialDefinition = {
  arity: number;
  applyAsync: E.SpecialApplicationAsync;
  applySync: E.SpecialApplicationSync; // TODO: Test these implementations
};

const _specialDefinitions: { [key in C.SpecialOperator]: SpecialDefinition } = {
  // --------------------------------------------------------------------------
  // Functional Forms
  // https://www.w3.org/TR/sparql11-query/#func-forms
  // --------------------------------------------------------------------------
  'bound': bound,
  'if': ifSPARQL,
  'coalesce': coalesce,
  '&&': logicalAnd,
  '||': logicalOr,
  'sameterm': sameTerm,
  'in': inSPARQL,
  'notin': notInSPARQL,
};

export const specialDefinitions = Map<C.SpecialOperator, SpecialDefinition>(_specialDefinitions);
