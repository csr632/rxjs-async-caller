import * as React from "react";
import { render } from "react-dom";
import { BrowserRouter, Link, Switch, Route } from "react-router-dom";
import AsyncCallerDemo from "./asyncCaller";
import AsyncCallerWithCacheDemo from "./asyncCallerWithCache";

function App() {
  return (
    <BrowserRouter>
      <ul>
        <li>
          <Link to="/asyncCaller">asyncCaller</Link>
        </li>
        <li>
          <Link to="/asyncCallerWithCache">asyncCallerWithCache</Link>
        </li>
      </ul>
      <Switch>
        <Route path="/asyncCaller" component={AsyncCallerDemo} />
        <Route
          path="/asyncCallerWithCache"
          component={AsyncCallerWithCacheDemo}
        />
      </Switch>
    </BrowserRouter>
  );
}

const rootEl = document.getElementById("app");
render(<App />, rootEl);
