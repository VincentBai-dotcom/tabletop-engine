import { expect, test } from "bun:test";
import * as kernel from "../src/index";

test("package root exports an object", () => {
  expect(kernel).toBeObject();
});
