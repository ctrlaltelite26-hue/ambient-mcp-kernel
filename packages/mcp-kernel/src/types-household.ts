import type { PolicyGrant, PolicyHousehold, PolicyMember } from "@chaperone/policy";

export interface KernelHouseholdState {
  household: PolicyHousehold;
  members: PolicyMember[];
  grants: PolicyGrant[];
}
