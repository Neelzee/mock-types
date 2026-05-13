import { test } from '@playwright/test';
import { paths } from "../definition";
import { createMockApi } from "../index";

const MockApi = createMockApi<paths>();

/*
 * This "test" has the correct typing on the mocking
 */
test("mocking pets", async ({ page }) => {
  // This mocks a get request, and is valid due to the inferred JSON object
  // matching the supplied value
  await MockApi(
    page,
    {
      path: "/pets",
      json: [{
        id: 2,
        name: "pet-name",
      }],
    }
  );

  // This mocks a post request
  await MockApi(
    page,
    {
      path: "/pets",
      method: "post",
      json: {
        id: 0,
        name: "pet-name"
      }
    }
  );

  // This is not a valid mock, since the response we've specified in the json
  // field does not match the specification, due to our method being get, but
  // this does not match the object we are passing
  await MockApi(
    page,
    {
      path: '/pets',
      method: "get",
      json: {
        // @ts-ignore
        id: 0,
        name: "pet-name",
        foobar: "foobar"
      }
    }
  )

  // The status code 500 is not specified in the mock, so TS will complain
  await MockApi(page, {
    path: "/pets",
    method: "get",
    // @ts-ignore
    status: 500
  });
});

