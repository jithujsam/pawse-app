import { describe, expect, it } from "vitest";
import { csvCell, parseCandidatesCsv, toCsv } from "@/lib/domain/csv";
import { maskPhone, normalizeIndianMobile } from "@/lib/domain/phone";

describe("normalizeIndianMobile", () => {
  it.each([
    ["+91 98765 43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["98765-43210", "+919876543210"],
    ["(+91) 6000 000 001", "+916000000001"],
  ])("accepts %s", (input, out) => expect(normalizeIndianMobile(input)).toBe(out));

  it.each(["", "12345", "+1 415 555 0100", "5876543210", "98765432101", "abc9876543210", "+44 9876543210"])(
    "rejects %s",
    (input) => expect(normalizeIndianMobile(input)).toBeNull(),
  );

  it("masks", () => expect(maskPhone("+919876543210")).toBe("+91 ••••• •3210"));
});

describe("parseCandidatesCsv", () => {
  it("accepts valid rows and normalises them", () => {
    const r = parseCandidatesCsv("Name,Phone,Consent,Language\nAsha Rao,98765 43210,yes,Hindi\nRavi,+919000000001,Y,\n");
    expect(r.errors).toEqual([]);
    expect(r.valid).toEqual([
      { line: 2, name: "Asha Rao", phone: "+919876543210", language: "hi" },
      { line: 3, name: "Ravi", phone: "+919000000001", language: "en" },
    ]);
  });

  it("rejects rows without consent", () => {
    const r = parseCandidatesCsv("name,phone,consent\nA,9876543210,no\nB,9876543211,\nC,9876543212,yes\n");
    expect(r.valid.map((v) => v.name)).toEqual(["C"]);
    expect(r.errors.filter((e) => e.field === "consent").map((e) => e.line)).toEqual([2, 3]);
  });

  it("flags invalid phones, empty names and unknown languages with line numbers", () => {
    const r = parseCandidatesCsv("name,phone,consent,language\n,9876543210,yes,en\nX,12345,yes,en\nY,9876543211,yes,tamil\n");
    expect(r.valid).toEqual([]);
    expect(r.errors).toEqual([
      { line: 2, field: "name", message: "Name is empty" },
      { line: 3, field: "phone", message: expect.stringContaining("Indian mobile") },
      { line: 4, field: "language", message: expect.stringContaining("English or Hindi") },
    ]);
  });

  it("removes duplicates within the file, keeping the first", () => {
    const r = parseCandidatesCsv("name,phone,consent\nA,9876543210,yes\nB,+91 98765 43210,yes\n");
    expect(r.valid.map((v) => v.name)).toEqual(["A"]);
    expect(r.duplicates).toEqual([{ line: 3, firstLine: 2 }]);
  });

  it("flags numbers already on the job", () => {
    const r = parseCandidatesCsv("name,phone,consent\nA,9876543210,yes\n", new Set(["+919876543210"]));
    expect(r.valid).toEqual([]);
    expect(r.errors[0].message).toContain("Already uploaded");
  });

  it("reports missing columns", () => {
    const r = parseCandidatesCsv("name,mobile\nA,9876543210\n");
    expect(r.errors[0]).toMatchObject({ field: "header", message: expect.stringContaining("phone") });
  });

  it("handles a UTF-8 BOM and Windows line endings", () => {
    const r = parseCandidatesCsv("﻿name,phone,consent\r\nA,9876543210,yes\r\n");
    expect(r.valid).toHaveLength(1);
  });
});

describe("CSV export", () => {
  it("neutralises formula injection", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+91 98")).toBe("'+91 98");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
  it("quotes commas and newlines", () => {
    expect(toCsv([["a,b", "c\nd", 5]])).toBe(`"a,b","c\nd",5\r\n`);
  });
});
