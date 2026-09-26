// Only the react-dom API the app uses (@types/react-dom is not installed).
declare module "react-dom" {
  export function useFormStatus(): { pending: boolean };
}
