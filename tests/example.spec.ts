import { test } from '@playwright/test';
import MockApi from "../index";

test("mocking pets", async ({ page }) => {
  await MockApi(
    page,
    "/pets",
    {
      status: 200,
      json: [{
        id: 2,
        name: "pet-name",
      }] 
    }
  );
});
