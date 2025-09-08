import { test } from '@playwright/test';
import MockApi from "../index";

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
      path: '/pets',
      method: "post",
      json: {
        id: 0,
        name: "pet-name"
      }
    }
  );

  // This is not a valid mock, since the response we've specified in the json
  // field does not match anything in the specification
  /*
  await MockApi(
    page,
    {
      path: '/pets',
      method: "get",
      json: {
        id: 0,
        name: "pet-name"
      }
    }
  )
  */

  // This is not specified in the mock, so TS will complain
  /*
  await MockApi(
    page,
    "/pets",
    {
      status: 500,
    }
  )
  */
});

