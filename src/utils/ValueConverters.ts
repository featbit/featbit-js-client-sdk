import { Regex } from "./Regex";

export interface IConvertResult<TValue> {
  isSucceeded: boolean,
  value?: TValue
}

export class ValueConverters {
  static bool(value: string): IConvertResult<boolean> {
    if (value?.toUpperCase() === 'TRUE') {
      return ValueConverters.success<boolean>(true);
    }

    if (value?.toUpperCase() === 'FALSE') {
      return ValueConverters.success<boolean>(false);
    }

    return ValueConverters.error<boolean>();
  }

  static number(value: string): IConvertResult<number> {
    const num = Number(value);

    if (Number.isNaN(num)) {
      return ValueConverters.error<number>();
    }

    return ValueConverters.success<number>(num);
  }

  static string(value: string): IConvertResult<string> {
    return ValueConverters.success<string>(value);
  }

  static json(value: string): IConvertResult<unknown> {
    try {
      const val = JSON.parse(value);
      return ValueConverters.success<unknown>(val);
    } catch (err) {
      return ValueConverters.error<unknown>();
    }
  }

  private static success<TValue>(value: TValue): IConvertResult<TValue> {
    return {
      isSucceeded: true,
      value: value
    }
  }

  private static error<TValue>(): IConvertResult<TValue> {
    return {
      isSucceeded: false
    }
  }
}