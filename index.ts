/**
 * This module uses `Type Families` and `Dependent Types` to infer expected
 * responses from a given endpoint.
 *
 * A type family, is like a HashMap on the type level, but the keys AND values
 * are types.
 * @example
 * ```ts
 * type TypeFamily<T> = T extends string ? number : string;
 * function foo<T>(t: T): TypeFamily<T> {
 *  if (typeof t === "string") {
 *    return 10 as TypeFamily<T>;
 *    } else {
 *    return "Not a number" as TypeFamily<T>;
 *    }
 * }
 * ```
 * It is more useful for restricting arguments, than restricting return types.
 *
 * A dependent type, is a type that is dependent on a value
 * @example
 * ```ts
 * type Foo<A> = A extends number ? string : Array<number>;
 * const x : Foo<number> = "banana";
 * const y : Foo<string> = [1,2,3];
 * ```
 * This is useful to do a "lookup" on a type family.
 *
 * @see https://en.wikipedia.org/wiki/Type_family
 * @see https://en.wikipedia.org/wiki/Dependent_type
 *
 * @author Nils Michael Fitjar <nilsien2001@gmail.com>
 */

import type { Page, Route } from "@playwright/test";
import type { paths } from "./definition";


/**
 * ExtractHTTPMethod is type family can give us the unions of the available
 * methods on any given path, specified by our specification.yaml file.
 *
 * This is achieved by checking on a type-level, if the methods defined at
 * path[P] are of type object, and if it is, then the type of ExtractHTTPMethod,
 * is the method, which is used both as a type and a value.
 *
 * This works since all our endpoints only have one method specified, since it
 * firsts checks if "get" is specified, then "put", "post", etc. Since all our
 * endpoints have atleast one method specified, we use the `never`-type to tell
 * TypeScript: "This case will never happen", so it can infer types easier.
 *
 * @example
 * ```ts
 * // This is inferred as "get", which is the only method on that path
 * let pets: ExtractHTTPMethod<"/pets/{id}">;
 * ```
 * The generic type P, is restricted, to only be the keys in the "object" paths.
 * This means the only valid "values", (string literals), of P, are the first
 * level fields on the paths interface.
 *
 * @see paths
 */
type ExtractHTTPMethod<P extends keyof paths>
  = (
    paths[P]["get"] extends object
    ? "get"
    : never
  )
  | (
    paths[P]["put"] extends object
    ? "put"
    : never
  )
  | (
    paths[P]["post"] extends object
    ? "post"
    : never
  )
  | (
    paths[P]["delete"] extends object
    ? "delete"
    : never
  )
  | (
    paths[P]["options"] extends object
    ? "options"
    : never
  )
  | (
    paths[P]["head"] extends object
    ? "head"
    : never
  )
  | (
    paths[P]["patch"] extends object
    ? "patch"
    : never
  )
  | (
    paths[P]["trace"] extends object
    ? "trace"
    : never
  );

/**
 * ExtractResponses resolves to a union of responses from a given path P, and
 * method M.
 *
 * Similar to ExtractHTTPMethod, ExtractResponses resolves to a type based on
 * the given type P, (which is an endpoint). But we might want to mock different
 * responses, not just 200 OK. So ExtractResponses does not resolve to a
 * concrete type, rather it resolves to a union of the different responses
 * specified in paths, by P. But since M is resolved by P, we don't need too
 * worry about it.
 *
 * @example
 * ```ts
 * // Resolves to 200: { headers: ..., content: ... } | 400: ...
 * let status: ExtractResponses<"/insurance/order", "post">;
 * // but with, ExtractHTTPMethod, we don't need to define M
 * type order = "/insurance/order";
 * let coolerStatus: ExtractResponses<order, ExtractHTTPMethod<order>>;
 * ```
 *
 * These types are specified in the operations interface.
 *
 * @see ExtractHTTPMethod
 * @see operations
 */
type ExtractResponses<P extends keyof paths, M extends ExtractHTTPMethod<P>> =
  // M is a method, resolved by P
  // and paths[P][M] is of type { responses: infer R },
  // resolve ExtractResponse<P, M> to the inferred type R, which is the response
  paths[P][M] extends { responses: infer R } ? R : never;

/**
 * Given a path P, a method M, and a response S, ResponseContent to a specific
 * type.
 *
 * This works since all the content-types of our endpoints are
 * "application/json".
 *
 * @example
 * ```ts
 * // resolves to the json-response on endpoint /insurance/order, method post
 * // and status code 200
 * let content: ResponseContent<"/insurance/order", "post", 200>;
 * ```
 */
type ResponseContent<
  P extends keyof paths,
  M extends ExtractHTTPMethod<P>,
  S extends keyof ExtractResponses<P, M>
> = ExtractResponses<P, M>[S] extends {
  content: { "application/json": infer R };
}
  ? R
  : never;

/**
 * Infers the type of allowed QueryParameters on a given path.
 *
 * P is the inferred path.
 * M is the inferred method.
 *
 * This resolves to the query parameter object, where the keys/fields of the
 * object correspond to the query parameter, and the value, corresponds to the
 * query parameter type.
 */
type QueryParameter<P extends keyof paths> =
  paths[P][ExtractHTTPMethod<P>] extends { parameters: { query?: infer R } }
  ? R extends undefined
  ? never
  : R
  : never;

/**
 * Infers the type of allowed PathParameters on a given path.
 *
 * P is the inferred path.
 * M is the inferred method.
 *
 * This resolves to the path parameter object, where the keys/fields of the
 * object correspond to the path parameter, and the value, corresponds to the
 * path parameter type.
 */
type PathParameter<P extends keyof paths> =
  paths[P][ExtractHTTPMethod<P>] extends { parameters: { path?: infer R } }
  ? R extends undefined
  ? never
  : R
  : never;

export type MockApiArg<
  P extends keyof paths,
  M extends ExtractHTTPMethod<P>,
  S extends keyof ExtractResponses<P, M>,
> = {
  path: P;
  status?: S;
  method?: M;
  json?: ResponseContent<P, ExtractHTTPMethod<P>, S>;
  query?: QueryParameter<P>;
  pathParam?: PathParameter<P>;
}

/**
 * @description
 * Mocks the given endpoint (path), with the given options, using
 * Playwrights mocking module.
 *
 * Gives type-inference based on the given path P, and the more
 * specific the arg is, the more type-inference is given.
 *
 * @example
 * ```ts
 * test(title, async ({ browser }) => {
 *  const ctx = await browser.newContext();
 *  const page = await ctx.newPage();
 *  // All that is needed to mock a 400 response.
 *  // If our response handling changes (ie. we dont just look at the status
 *  // code), you have to also specify the json
 *  await MockApi(page, { path: "/insurance/order", status: 400 });
 * }
 * ```
 *
 * @returns void
 */
const MockApi = async <
  P extends keyof paths,
  M extends ExtractHTTPMethod<P> = ExtractHTTPMethod<P>,
  S extends keyof ExtractResponses<P, M> = keyof ExtractResponses<P, M>,
>(
  page: Page,
  {
    path,
    status,
    json,
    query,
    pathParam,
  }: MockApiArg<P, M, S>
): Promise<void> => {
  const pathString = Object.entries(pathParam || [])
    .reduce(
      (acc, [k, v]) =>
        acc.replace(`{${k}}`, encodeURIComponent(v)),
      `${path.replaceAll("/", "\\/")}`
    );
  return page.route(
    new RegExp(
      `^${process.env.BASE_URL}${pathString}${(query === undefined ? "$" : `\\?${mkQParams(query!)}$`)}`
    ),
    async (route: Route) =>
      await route.fulfill({
        path,
        json,
        status: typeof status === "number" ? status : undefined
      })
  );
};


export default MockApi;

const mkQParams = (query: Record<string, any>) =>
  Object.entries(query)
    .map(([param, value]) => `${param}=${value}`)
    .join("&");
