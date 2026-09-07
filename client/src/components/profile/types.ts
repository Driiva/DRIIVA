/**
 * The editable profile fields the edit mode writes back to Firestore.
 * Extracted verbatim from client/src/pages/profile.tsx.
 */
export interface EditableFields {
  displayName: string;
  phoneNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
}

