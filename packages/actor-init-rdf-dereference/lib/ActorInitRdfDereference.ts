import {ActorInit, IActionInit, IActorOutputInit} from "@comunica/bus-init";
import {IActionRdfDereference, IActorRdfDereferenceOutput} from "@comunica/bus-rdf-dereference";
import {IActorRdfParseOutput} from "@comunica/bus-rdf-parse";
import {Actor, IActorArgs, IActorTest, Mediator} from "@comunica/core";
import {Readable} from "stream";

/**
 * An RDF Parse actor that listens on the 'init' bus.
 *
 * It requires a mediator that is defined over the 'rdf-parse' bus,
 * and a mediaType that identifies the RDF serialization.
 */
export class ActorInitRdfDereference extends ActorInit implements IActorInitRdfParseArgs {

  public readonly mediatorRdfDereference: Mediator<Actor<IActionRdfDereference, IActorTest, IActorRdfDereferenceOutput>,
    IActionRdfDereference, IActorTest, IActorRdfDereferenceOutput>;
  public readonly url?: string;

  constructor(args: IActorInitRdfParseArgs) {
    super(args);
    if (!this.mediatorRdfDereference) {
      throw new Error('A valid "mediatorRdfDereference" argument must be provided.');
    }
  }

  public async test(action: IActionInit): Promise<IActorTest> {
    return null;
  }

  public async run(action: IActionInit): Promise<IActorOutputInit> {
    const dereference: IActionRdfDereference = {
      url: action.argv.length > 0 ? action.argv[0] : this.url,
    };
    if (!dereference.url) {
      throw new Error('A URL must be given either in the config or as CLI arg');
    }
    const result: IActorRdfParseOutput = await this.mediatorRdfDereference.mediate(dereference);

    result.quads.on('data', (quad) => readable.push(JSON.stringify(quad) + '\n'));
    result.quads.on('end', () => readable.push(null));
    const readable = new Readable();
    readable._read = () => {
      return;
    };

    return { stdout: readable };
  }

}

export interface IActorInitRdfParseArgs extends IActorArgs<IActionInit, IActorTest, IActorOutputInit> {
  mediatorRdfDereference: Mediator<Actor<IActionRdfDereference, IActorTest, IActorRdfDereferenceOutput>,
    IActionRdfDereference, IActorTest, IActorRdfDereferenceOutput>;
  url?: string;
}
