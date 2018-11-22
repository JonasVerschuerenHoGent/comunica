import { Map } from 'immutable';
import * as RDF from 'rdf-js';
import { Algebra as Alg } from 'sparqlalgebrajs';

/**
 * An immutable solution mapping object.
 * This maps variables to a terms.
 *
 * Variables are represented as strings containing the variable name (without '?').
 * Terms are named nodes, literals or the default graph.
 */
export type Bindings = Map<string, RDF.Term>;

/**
 * A convenience constructor for bindings based on a given hash.
 * @param {{[p: string]: RDF.Term}} hash A hash that maps variable names to terms.
 * @return {Bindings} The immutable bindings from the hash.
 * @constructor
 */
export function Bindings(hash: { [key: string]: RDF.Term }): Bindings {
  return Map(hash);
}

// TODO: Document
export type AsyncLookUp = (expr: Alg.ExistenceExpression) => Promise<boolean>;

type Aggregator = (distinct: boolean, expression: Alg.Expression, separator?: string) => Promise<RDF.Term>;
export type AsyncAggregator = { [key: string]: Aggregator } & {
  count(distinct: boolean, exp: Alg.Expression): Promise<RDF.Term>;
  sum(distinct: boolean, exp: Alg.Expression): Promise<RDF.Term>;
  min(distinct: boolean, exp: Alg.Expression): Promise<RDF.Term>;
  max(distinct: boolean, exp: Alg.Expression): Promise<RDF.Term>;
  avg(distinct: boolean, exp: Alg.Expression): Promise<RDF.Term>;
  groupConcat(distinct: boolean, exp: Alg.Expression, seperator?: string): Promise<RDF.Term>;
  sample(distinct: boolean, exp: Alg.Expression): Promise<RDF.Term>;
};
