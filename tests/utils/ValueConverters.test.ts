import { ValueConverters } from "../../src/utils/ValueConverters";

describe('given a ValueConverter', () => {
  const boolTestCases: [string, boolean][] = [
    ['true', true],
    ['TRUE', true],
    ['false', false],
    ['FALSE', false]
  ];

  const numberTestCases: [string, number | undefined][] = [
    ['123', 123],
    ['123.4', 123.4],
    ['v123', undefined],
    ['123.45', 123.45],
    ['123.456', 123.456]
  ];

  const stringTestCases: [string, string][] = [['hello', 'hello']];

  it.each(boolTestCases)('converts %s to %s', (input, expected) => {
    expect(ValueConverters.bool(input).value).toBe(expected);
  });

  it.each(stringTestCases)('converts %s to %s', (input, expected) => {
    expect(ValueConverters.string(input).value).toBe(expected);
  });

  it.each(numberTestCases)('converts %s to %s', (input, expected) => {
    expect(ValueConverters.number(input).value).toBe(expected);
  });

  it('convert valid json string to object', () => {
    const json = '{"hello": "world"}';
    expect(ValueConverters.json(json).value).toMatchObject({ hello: 'world' });
  })

  it('convert invalid json string to undefined', () => {
    const result = ValueConverters.json('abc');

    expect(result.isSucceeded).toBe(false);
    expect(result.value).toBeUndefined();
  })
});