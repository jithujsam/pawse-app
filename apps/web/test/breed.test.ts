import { describe, expect, it } from "vitest";
import { breedFor, coatFor, coatsFor } from "../src/pets";
import { modelFor } from "../src/pet3d-support";

describe("dog breeds", () => {
  it("a dog with no breed is a Shiba Inu, and its model is the Shiba", () => {
    expect(breedFor("dog")?.id).toBe("shiba");
    expect(modelFor("dog", undefined)).toBe("models/dog.glb");
  });

  it("a Husky dog loads the Husky model", () => {
    expect(breedFor("dog", "husky")?.id).toBe("husky");
    expect(modelFor("dog", "husky")).toBe("models/husky.glb");
  });

  it("an unknown breed falls back to the first one", () => {
    expect(breedFor("dog", "poodle")?.id).toBe("shiba");
  });

  it("other species have no breeds and keep their model", () => {
    expect(breedFor("cat")).toBeUndefined();
    expect(modelFor("cat", "husky")).toBe("models/cat.glb");
  });

  it("a Husky has its own colourings, and a Shiba keeps the dog coats", () => {
    expect(coatsFor("dog", "husky").map((c) => c.id)).toEqual(["grey", "black", "red"]);
    expect(coatsFor("dog", "shiba").map((c) => c.id)).toEqual(["golden", "cocoa", "cream"]);
    expect(coatFor("dog", "black", "husky").id).toBe("black");
    expect(coatFor("dog", "golden", "husky").id).toBe("grey");
  });
});
