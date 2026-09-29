const configuredValue = import.meta.env.VITE_PUBLIC_REGISTRATION

// Production is invite-only unless the deployment explicitly opts in. Local
// development stays convenient, while setting false always disables sign-up.
export const publicRegistrationEnabled =
  configuredValue === 'true' || (configuredValue === undefined && !import.meta.env.PROD)
