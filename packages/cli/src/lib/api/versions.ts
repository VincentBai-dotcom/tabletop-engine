import { Type, type Static } from "@sinclair/typebox";

export const PresignedUploadSchema = Type.Object({
  url: Type.String(),
  headers: Type.Record(Type.String(), Type.String()),
});

export type PresignedUpload = Static<typeof PresignedUploadSchema>;

export const CreateVersionResponseSchema = Type.Object({
  versionId: Type.String(),
  versionNumber: Type.Number(),
  putUrls: Type.Object({
    projectSource: PresignedUploadSchema,
  }),
  expiresAt: Type.String(),
});

export type CreateVersionResponse = Static<typeof CreateVersionResponseSchema>;

export const StartBuildResponseSchema = Type.Object({
  buildId: Type.String(),
});

export type StartBuildResponse = Static<typeof StartBuildResponseSchema>;
