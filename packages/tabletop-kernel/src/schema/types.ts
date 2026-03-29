import type { TSchema } from "@sinclair/typebox";
import type { StateClass } from "../state-facade/metadata";

export type StateFieldTargetFactory = () => StateClass;

export interface NumberFieldType {
  kind: "number";
  readonly schema?: TSchema;
}

export interface StringFieldType {
  kind: "string";
  readonly schema?: TSchema;
}

export interface BooleanFieldType {
  kind: "boolean";
  readonly schema?: TSchema;
}

export interface NestedStateFieldType {
  kind: "state";
  target: StateFieldTargetFactory;
}

export interface ArrayFieldType {
  kind: "array";
  item: FieldType;
  readonly schema?: TSchema;
}

export interface RecordFieldType {
  kind: "record";
  key: PrimitiveFieldType;
  value: FieldType;
  readonly schema?: TSchema;
}

export interface ObjectFieldType {
  kind: "object";
  properties: Record<string, FieldType>;
  readonly schema?: TSchema;
}

export interface OptionalFieldType {
  kind: "optional";
  item: FieldType;
  readonly schema?: TSchema;
}

export type PrimitiveFieldType =
  | NumberFieldType
  | StringFieldType
  | BooleanFieldType;

export type FieldType =
  | PrimitiveFieldType
  | NestedStateFieldType
  | ArrayFieldType
  | RecordFieldType
  | ObjectFieldType
  | OptionalFieldType;

export type StateFieldMetadata = FieldType;

export type SerializableSchema =
  | PrimitiveFieldType
  | ArrayFieldType
  | RecordFieldType
  | ObjectFieldType
  | OptionalFieldType;

type InferSerializableSchema<TSchema extends FieldType> =
  TSchema extends NumberFieldType
    ? number
    : TSchema extends StringFieldType
      ? string
      : TSchema extends BooleanFieldType
        ? boolean
        : TSchema extends OptionalFieldType
          ? InferSerializableSchema<
              Extract<TSchema["item"], SerializableSchema>
            >
          : TSchema extends ArrayFieldType
            ? Array<
                InferSerializableSchema<
                  Extract<TSchema["item"], SerializableSchema>
                >
              >
            : TSchema extends RecordFieldType
              ? Record<
                  string,
                  InferSerializableSchema<
                    Extract<TSchema["value"], SerializableSchema>
                  >
                >
              : TSchema extends ObjectFieldType
                ? InferObjectSchema<TSchema["properties"]>
                : never;

type InferObjectSchema<TProperties extends Record<string, FieldType>> = {
  [K in keyof TProperties as TProperties[K] extends OptionalFieldType
    ? never
    : K]: InferSerializableSchema<Extract<TProperties[K], SerializableSchema>>;
} & {
  [K in keyof TProperties as TProperties[K] extends OptionalFieldType
    ? K
    : never]?: TProperties[K] extends OptionalFieldType
    ? InferSerializableSchema<
        Extract<TProperties[K]["item"], SerializableSchema>
      >
    : never;
};

export type InferSchema<TSchema extends SerializableSchema> =
  InferSerializableSchema<TSchema>;
