import type { ImportResult } from "../types";

/** Behind this interface, each brokerage's export format is one adapter.
 *  Fidelity ships first; a Schwab or Robinhood CSV (or an aggregator API
 *  like SnapTrade later) is just another implementation of `parse`. */
export interface BrokerImporter {
  readonly name: string;
  parse(fileContents: string): ImportResult;
}
