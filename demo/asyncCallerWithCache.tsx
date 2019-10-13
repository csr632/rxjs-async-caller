import * as React from "react";
import { useObservable } from "rxjs-hooks";
import asyncCallerWithCache from "../src/asyncCallerWithCache";
import { Subject } from "rxjs";
import { filter } from "rxjs/operators";
import retryStrategy from "./retryStrategy";

const AsyncCallerWithCacheDemo: React.FC<{}> = () => {
  const [query$] = React.useState(() => new Subject<string>());
  const [invalidateCache, setInvalidateCache] = React.useState("");
  const [invalidateCacheSignal$] = React.useState(() => new Subject<string>());
  const [result$] = React.useState(() =>
    asyncCallerWithCache({
      query$: query$.pipe(filter(q => !!q)),
      calleeFn: (query: string): Promise<string> => {
        console.log(`actual sending request! query: ${query}`);
        return new Promise((res, rej) => {
          switch (query) {
            case "timeout":
              setTimeout(() => {
                res("resolve after timeout");
              }, 2000);
              break;
            case "err":
              setTimeout(() => {
                rej("err!");
              }, 1000);
              break;
            default:
              setTimeout(() => {
                res(`response for ${query}`);
              }, 1000);
              break;
          }
        });
      },
      getCacheKey: q => q,
      invalidateCache$: invalidateCacheSignal$,
      ...retryStrategy
    })
  );

  const query = useObservable(() => query$, "");
  const result = useObservable(() => result$, null);

  const resultText = (() => {
    if (!query || !result) return "no query yet";
    switch (result.type) {
      case "loading":
        return "loading";
      case "success":
        return `success: ${result.response}`;
      case "error":
        return `error: ${String(result.error)}`;
      default:
        throw new Error(`unexpected result: ${result}`);
    }
  })();

  return (
    <div>
      <div>
        query:
        <input
          type="text"
          value={query}
          onChange={v => {
            query$.next(v.target.value);
          }}
        />
      </div>
      <div>
        invalidateCache:
        <input
          type="text"
          value={invalidateCache}
          onChange={v => {
            setInvalidateCache(v.target.value);
          }}
        />
        <button
          onClick={v => {
            invalidateCacheSignal$.next(invalidateCache);
          }}
        >
          invalidateCache
        </button>
      </div>
      <div>resultText: {resultText}</div>
    </div>
  );
};

export default AsyncCallerWithCacheDemo;
