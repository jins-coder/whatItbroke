/**
 * Example Angular Component with Missing Provider Dependency Injection Failure
 */

export class UserService {
  // Missing @Injectable({ providedIn: 'root' })
  public getProfile() {
    return { name: 'Alice' };
  }
}

export class DashboardComponent {
  // Injected service not provided in providers array
  constructor(public userService: UserService) {}

  public ngOnInit() {
    this.userService.getProfile();
  }
}
