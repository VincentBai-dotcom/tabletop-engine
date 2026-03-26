import { expect, test } from "bun:test";
import * as kernel from "../src/index";

test("package root exports an object", () => {
  expect(kernel).toBeObject();
  expect(kernel.GameDefinitionBuilder).toBeDefined();
  expect("defineGame" in kernel).toBe(false);
});
