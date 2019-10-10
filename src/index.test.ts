import {
  Observable,
  combineLatest,
  defer,
  of,
  from,
  ConnectableObservable,
  Subject
} from "rxjs";
import {
  switchMap,
  map,
  startWith,
  catchError,
  publishReplay,
  filter,
  publishBehavior,
  mapTo,
  tap,
  scan
} from "rxjs/operators";

const sub = new Subject();

sub.next(undefined);

// sub.complete();

const fetchSignal$ = sub.pipe(
  tap(() => {
    console.log("sub");
  }),
  startWith(undefined),
  tap(() => {
    console.log("sub2");
  }),
  scan(acc => acc + 1, -1)
);

it("works", done => {
  const results = [];

  fetchSignal$.subscribe(
    v => {
      // console.log("v", v);
      results.push(v);
    },
    err => {
      console.error(err);
      throw err;
    },
    () => {
      console.log("comp", results);
      expect(results).toEqual([0, 1]);
      done();
    }
  );

  sub.next(undefined);

  sub.complete();
});
