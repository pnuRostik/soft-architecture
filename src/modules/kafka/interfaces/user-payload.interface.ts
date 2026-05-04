import { Role } from '@prisma/client';

/** Outbound Kafka user shape aligned with AsyncAPI `UserPayload` (firstname / lowercase role). */
export type KafkaUserEventPayload = {
  id: number;
  firstname?: string;
  lastname?: string;
  email: string;
  role: 'user' | 'admin';
  auth_provider?: string;
  is_activated?: boolean;
  locality_id?: number;
  longitude?: number;
  latitude?: number;
  updated_at?: string;
};

export function userRecordToKafkaPayload(input: {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: Role;
  auth_provider: string;
  is_activated: boolean;
  locality_id: number | null;
  longitude: number | null;
  latitude: number | null;
  updatedAt?: Date;
}): KafkaUserEventPayload {
  return {
    id: input.id,
    firstname: input.first_name ?? undefined,
    lastname: input.last_name ?? undefined,
    email: input.email,
    role: input.role === Role.ADMIN ? 'admin' : 'user',
    auth_provider: input.auth_provider,
    is_activated: input.is_activated,
    locality_id: input.locality_id ?? undefined,
    longitude: input.longitude ?? undefined,
    latitude: input.latitude ?? undefined,
    updated_at: input.updatedAt?.toISOString(),
  };
}
