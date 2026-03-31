import type {
  Static,
  TArray,
  TBoolean,
  TNumber,
  TObject,
  TOptional,
  TRecord,
  TSchema,
  TString,
} from "@sinclair/typebox";
import type { StateClass } from "../state-facade/metadata";

export type StateFieldTargetFactory = () => StateClass;

type ExtractSchema<TField> = TField extends {
  readonly schema?: infer TFieldSchema;
}
  ? Extract<TFieldSchema, TSchema> extends never
    ? TSchema
    : Extract<TFieldSchema, TSchema>
  : TSchema;

type ObjectSchemaProperties<TProperties> =
  TProperties extends Record<string, unknown>
    ? { [K in keyof TProperties]: ExtractSchema<TProperties[K]> }
    : Record<string, TSchema>;

export type NumberFieldType = TNumber & {
  kind: "number";
  readonly schema?: TNumber;
};

export type StringFieldType = TString & {
  kind: "string";
  readonly schema?: TString;
};

export type BooleanFieldType = TBoolean & {
  kind: "boolean";
  readonly schema?: TBoolean;
};

export interface NestedStateFieldType {
  kind: "state";
  target: StateFieldTargetFactory;
}

// Recursive field composition still needs broad defaults internally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArrayFieldType<TItem = any> = TArray<ExtractSchema<TItem>> & {
  kind: "array";
  item: TItem;
  readonly schema?: TArray<ExtractSchema<TItem>>;
};

export type RecordFieldType<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TKey = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TValue = any,
> = TRecord<ExtractSchema<TKey>, ExtractSchema<TValue>> & {
  kind: "record";
  key: TKey;
  value: TValue;
  readonly schema?: TRecord<ExtractSchema<TKey>, ExtractSchema<TValue>>;
};

export type ObjectFieldType<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TProperties extends Record<string, any> = Record<string, any>,
> = TObject<ObjectSchemaProperties<TProperties>> & {
  kind: "object";
  properties: TProperties;
  readonly schema?: TObject<ObjectSchemaProperties<TProperties>>;
};

// Recursive field composition still needs broad defaults internally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OptionalFieldType<TItem = any> = TOptional<ExtractSchema<TItem>> & {
  kind: "optional";
  item: TItem;
  readonly schema?: TOptional<ExtractSchema<TItem>>;
};

export type PrimitiveFieldType =
  | NumberFieldType
  | StringFieldType
  | BooleanFieldType;

export type FieldType =
  | PrimitiveFieldType
  | NestedStateFieldType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ArrayFieldType<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | RecordFieldType<any, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ObjectFieldType<Record<string, any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | OptionalFieldType<any>;

export type StateFieldMetadata = FieldType;

export type SerializableSchema =
  | PrimitiveFieldType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ArrayFieldType<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | RecordFieldType<any, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | ObjectFieldType<Record<string, any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | OptionalFieldType<any>;

export type ArraySchemaStatic<TItem> = Static<TArray<ExtractSchema<TItem>>>;

export type RecordSchemaStatic<TKey, TValue> = Static<
  TRecord<ExtractSchema<TKey>, ExtractSchema<TValue>>
>;

export type ObjectSchemaStatic<TProperties> = Static<
  TObject<ObjectSchemaProperties<TProperties>>
>;

export type OptionalSchemaStatic<TItem> = Static<
  TOptional<ExtractSchema<TItem>>
>;
