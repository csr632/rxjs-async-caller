import * as React from "react";
import { render } from "react-dom";
import { useObservable } from "rxjs-hooks";
import asyncCallerWithCache from "./asyncCallerWithCache";
import { Subject } from "rxjs";
import { filter } from "rxjs/operators";

const el = document.getElementById("app");
function App() {
  const [query$] = React.useState(() => new Subject<string>());
  const [invalidateCache, setInvalidateCache] = React.useState("");
  const [invalidateCacheSignal$] = React.useState(() => new Subject<string>());
  const [result$] = React.useState(() =>
    asyncCallerWithCache<string, string>({
      query$: query$.pipe(filter(q => !!q)),
      calleeFn: (query: string) => {
        console.log(`actual sending request! query: ${query}`);
        return new Promise((res, rej) => {
          setTimeout(() => {
            if (query === "111") {
              rej("err!");
            }
            res(`response for ${query}`);
          }, 2000);
        });
      },
      getCacheKey: q => q,
      invalidateCache$: invalidateCacheSignal$
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
        return result.response;
      case "error":
        return String(result.error);
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
}
render(<App />, el);
// document.getElementById("app").innerHTML = `
// <h1>Hello Parcel!</h1>
// <div>
//   Look
//   <a href="https://parceljs.org" target="_blank" rel="noopener noreferrer">here</a>
//   for more info about Parcel.
// </div>
// `;
