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
 * Type families are most useful as constraints, giving more information by
 * _restricting_ the type based on another one.
 *
 * A dependent type, is a type that is dependent on a value. Like knowning that
 * calling a GET on /foo returns a number, but calling DELETE on /foo gives a
 * string. Here the dependent type is the response, which is dependent on the
 * HTTP-method we use.
 * 
 * It is possible to infer the response of an API-call, based on the path. This
 * is one of the motivations behind the openapi-typescript library, which is
 * used here to extend this type-inferrence to mocking, ensuring that when one
 * mock API-responses, they still match the expected type of the API
 * documentation.
 * 
 * @see https://en.wikipedia.org/wiki/Type_family
 * @see https://en.wikipedia.org/wiki/Dependent_type
 *
 * @author Nils Michael Fitjar <nilsien2001@gmail.com>
 */

import type { Page, Route } from "@playwright/test";

type HttpMethod
  = "get"
  | "put"
  | "post"
  | "delete"
  | "options"
  | "head"
  | "patch"
  | "trace"
  ;

type PathItem = Partial<Record<HttpMethod, unknown>> & {
  parmeters?: unknown;
};

type KeyPath<P> = string & keyof P


/**
 * ExtractHTTPMethod is type family can give us the unions of the available
 * methods on any given path, specified by our specification.yaml file.
 *
 * This is achieved by checking on a type-level, if the methods defined at
 * path[P] are of type object, and if it is, then the type of ExtractHTTPMethod,
 * is the method, which is used both as a type and a value.
 *
 * @example
 * ```ts
 * import type { paths } from "./definition";
 * // This is inferred as "get", which is the only method on that path
 * let pets: ExtractHTTPMethod<paths, "/pets/{id}">;
 * ```
 * The generic type P, is restricted, to only be the keys in the "object" paths.
 * This means the only valid "values", (string literals), of P, are the first
 * level fields on the paths interface.
 */
type ExtractHTTPMethod<Paths extends { [K in keyof Paths]: PathItem }, P extends KeyPath<Paths>> = {
  [M in HttpMethod]: Paths[P][M] extends object ? M : never;
}[HttpMethod];

/**
 * ExtractResponses resolves to a union of responses from a given path P, and
 * method M.
 *
 * Similar to ExtractHTTPMethod, ExtractResponses resolves to a type based on
 * the given type P, (which is an endpoint). But we might want to mock different
 * responses, not just 200 OK. So ExtractResponses does not resolve to a
 * concrete type, rather it resolves to a union of the different responses
 * specified in paths, by P. But since M is resolved by P, we don't need to
 * worry about it.
 *
 * @example
 * ```ts
 * import type { paths } from "./definition";
 * // Resolves to 200: { headers: ..., content: ... } | 400: ...
 * let status: ExtractResponses<paths, "/insurance/order", "post">;
 * // but with, ExtractHTTPMethod, we don't need to define M
 * type order = "/insurance/order";
 * let coolerStatus: ExtractResponses<paths, order, ExtractHTTPMethod<paths, order>>;
 * ```
 *
 * These types are specified in the operations interface.
 *
 * @see ExtractHTTPMethod
 * @see operations
 */
type ExtractResponses<
  Paths extends { [K in keyof Paths]: PathItem },
  P extends KeyPath<Paths>,
  M extends ExtractHTTPMethod<Paths, P>
> =
  // M is a method, resolved by P
  // and paths[P][M] is of type { responses: infer R },
  // resolve ExtractResponse<Paths, P, M> to the inferred type R, which is the
  // response
  Paths[P][M] extends { responses: infer R } ? R : never;

/**
 * Given Paths, a path P, a method M, and a response S, ResponseContent resolves 
 * to a specific response type.
 *
 * This works since all the content-types of our endpoints are
 * "application/json".
 *
 * @example
 * ```ts
 * import type { paths } from "./definition"
 * // resolves to the json-response on endpoint /insurance/order, method post
 * // and status code 200
 * let content: ResponseContent<paths, "/insurance/order", "post", 200>;
 * ```
 */
type ResponseContent<
  Paths extends { [K in keyof Paths]: PathItem },
  P extends KeyPath<Paths>,
  M extends ExtractHTTPMethod<Paths, P>,
  S extends keyof ExtractResponses<Paths, P, M>
> = ExtractResponses<Paths, P, M>[S] extends {
  content: { "application/json": infer R };
}
  ? R
  : never;

/**
 * Infers the type of allowed QueryParameters on a given path.
 *
 * P is the inferred path.
 *
 * This resolves to the query parameter object, where the keys/fields of the
 * object correspond to the query parameter, and the value, corresponds to the
 * query parameter type.
 */
type QueryParameter<Paths extends { [K in keyof Paths]: PathItem }, P extends KeyPath<Paths>> =
  Paths[P][ExtractHTTPMethod<Paths, P>] extends { parameters: { query?: infer R } }
  ? R extends undefined
  ? never
  : R
  : never;

/**
 * Infers the type of allowed PathParameters on a given path.
 *
 * P is the inferred path.
 *
 * This resolves to the path parameter object, where the keys/fields of the
 * object correspond to the path parameter, and the value, corresponds to the
 * path parameter type.
 */
type PathParameter<Paths extends { [K in keyof Paths]: PathItem }, P extends KeyPath<Paths>> =
  Paths[P][ExtractHTTPMethod<Paths, P>] extends { parameters: { path?: infer R } }
  ? R extends undefined
  ? never
  : R
  : never;

export type MockApiArg<
  Paths extends { [K in keyof Paths]: PathItem },
  P extends KeyPath<Paths>,
  M extends ExtractHTTPMethod<Paths, P>,
  S extends keyof ExtractResponses<Paths, P, M>,
> = {
  path: P;
  status?: S;
  method?: M;
  json?: ResponseContent<Paths, P, ExtractHTTPMethod<Paths, P>, S>;
  query?: QueryParameter<Paths, P>;
  pathParam?: PathParameter<Paths, P>;
}

export const createMockApi = <Paths extends { [K in keyof Paths]: PathItem }>() => async <
  P extends KeyPath<Paths> = KeyPath<Paths>,
  M extends ExtractHTTPMethod<Paths, P> = ExtractHTTPMethod<Paths, P>,
  S extends keyof ExtractResponses<Paths, P, M> = keyof ExtractResponses<Paths, P, M>,
>(
  page: Page,
  {
    path,
    status,
    json,
    query,
    pathParam,
  }: MockApiArg<Paths, P, M, S>
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

const mkQParams = (query: Record<string, any>) =>
  Object.entries(query)
    .map(([param, value]) => `${param}=${value}`)
    .join("&");
