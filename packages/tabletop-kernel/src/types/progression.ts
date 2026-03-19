export interface ProgressionSegmentDefinition {
  id: string;
  kind: string;
  name: string;
  parentId?: string;
}

export interface ProgressionDefinition {
  initial?: string | null;
  segments: Record<string, ProgressionSegmentDefinition>;
}

export interface ProgressionSegmentState {
  id: string;
  kind: string;
  name: string;
  parentId?: string;
  active: boolean;
  ownerId?: string;
}

export interface ProgressionState {
  current: string | null;
  segments: Record<string, ProgressionSegmentState>;
}
