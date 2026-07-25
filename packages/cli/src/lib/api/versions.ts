import { Type, type Static } from "@sinclair/typebox";

/**
 * A presigned PUT target. `headers` must be sent verbatim on the upload: the
 * declared sha256 is bound into the signature, so object storage rejects a body
 * whose digest differs. Omitting a header invalidates the signature.
 */
export const PresignedUploadSchema = Type.Object({
  url: Type.String(),
  headers: Type.Record(Type.String(), Type.String()),
});

export type PresignedUpload = Static<typeof PresignedUploadSchema>;

/**
 * `POST /versions` — allocates a version number and issues one short-lived
 * presigned PUT per source tarball. Bytes go straight from the CLI to storage;
 * platform-api never sees them.
 */
export const CreateVersionResponseSchema = Type.Object({
  versionId: Type.String(),
  versionNumber: Type.Number(),
  putUrls: Type.Object({
    engineSource: PresignedUploadSchema,
    frontendSource: PresignedUploadSchema,
  }),
  /** The instant both presigned URLs expire. */
  expiresAt: Type.String(),
});

export type CreateVersionResponse = Static<typeof CreateVersionResponseSchema>;

/** `POST /versions/:versionId/build`. */
export const StartBuildResponseSchema = Type.Object({
  buildId: Type.String(),
});

export type StartBuildResponse = Static<typeof StartBuildResponseSchema>;
