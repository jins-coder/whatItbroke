/**
 * Example React Component crashing during initial render before API response resolves
 */

export interface UserProfileProps {
  user?: {
    profile?: {
      name: string;
      email: string;
    };
  };
  isLoading?: boolean;
}

export function UserProfile({ user }: UserProfileProps) {
  // Vulnerable code: accessing user.profile.name when user or user.profile is undefined
  // Triggers during initial render when API is inflight:
  // TypeError: Cannot read properties of undefined (reading 'name')
  return (
    <div className="user-profile">
      <h1>{(user as any).profile.name}</h1>
    </div>
  );
}

export function Dashboard(props: UserProfileProps) {
  return <UserProfile {...props} />;
}

export function App(props: UserProfileProps) {
  return <Dashboard {...props} />;
}
