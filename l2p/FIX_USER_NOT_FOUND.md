# Fix for "User not found" Error When Creating Lobbies

## Problem
Users authenticated via OAuth were unable to create lobbies, receiving a "User not found" error even though they were successfully authenticated. The error occurred because:

1. The user exists in the **central auth service** database
2. The user does NOT exist in the **L2P service** local database
3. The `createLobby` method was trying to look up the user in the local database

## Root Cause
The `LobbyService.createLobby` method was attempting to fetch user data (username, character, level) from the local database, but OAuth users only exist in the centralized auth service. The JWT token already contains all necessary user information, but this data wasn't being passed to the service layer.

## Solution
Modified the code to pass user data from the JWT token (which is already available in `req.user`) to the `createLobby` method, eliminating the need for database lookups.

### Changes Made

#### 1. Updated `CreateLobbyRequest` Interface
**File:** `/home/patrick/projects/l2p/backend/src/services/LobbyService.ts`

Added optional fields to accept user data from the JWT token:
```typescript
export interface CreateLobbyRequest {
  hostId: number;
  username?: string; // Username from JWT token
  selectedCharacter?: string; // Character from JWT token
  characterLevel?: number; // Character level from JWT token
  questionCount?: number;
  questionSetIds?: number[];
  settings?: Record<string, unknown>;
}
```

#### 2. Modified `createLobby` Method
**File:** `/home/patrick/projects/l2p/backend/src/services/LobbyService.ts`

Updated the method to use provided user data first, falling back to database lookup only if not provided:
```typescript
async createLobby(request: CreateLobbyRequest): Promise<LobbyWithPlayers> {
  let hostUsername = request.username || `user_${request.hostId}`;
  let hostCharacter = request.selectedCharacter || 'student';
  let hostCharacterLevel = request.characterLevel || 1;

  // If user data wasn't provided in the request (legacy flow), try to fetch it
  if (!request.username) {
    // Try to get game profile first (OAuth users)
    try {
      const profile = await this.gameProfileService.getOrCreateProfile(request.hostId);
      hostCharacter = profile.selectedCharacter;
      hostCharacterLevel = profile.characterLevel;
    } catch (error) {
      // Fall back to legacy user
      const host = await this.userRepository.findUserById(request.hostId);
      if (!host) {
        throw new Error('Host user not found');
      }
      hostUsername = host.username;
      hostCharacter = host.selected_character || 'student';
      hostCharacterLevel = host.character_level;
    }
  }
  // ... rest of the method
}
```

#### 3. Updated Route Handler
**File:** `/home/patrick/projects/l2p/backend/src/routes/lobbies.ts`

Modified the POST `/api/lobbies` endpoint to pass user data from the JWT token:
```typescript
const createRequest: CreateLobbyRequest = {
  hostId: req.user.userId,
  username: req.user.username,
  selectedCharacter: req.user.selectedCharacter,
  characterLevel: req.user.characterLevel,
  questionCount: value.questionCount,
  questionSetIds: value.questionSetIds,
  settings: value.settings
};
```

## Deployment Instructions

### Local Development
1. The code has already been built: `npm run build` was executed successfully
2. If running locally with `npm run dev`, restart the development server

### Production (Docker)
Since the backend is running in a Docker container (`l2p-api`), you need to rebuild and restart it:

```bash
# Navigate to the project directory
cd /home/patrick/projects/l2p

# Rebuild the Docker images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build backend

# Restart the backend service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend

# Verify the container is running
docker ps | grep l2p-api

# Check logs for any errors
docker logs l2p-api --tail 50
```

### Alternative: If Docker is on a Remote Server
If the Docker containers are running on a remote production server:

1. **Commit and push the changes:**
   ```bash
   cd /home/patrick/projects/l2p
   git add backend/src/services/LobbyService.ts backend/src/routes/lobbies.ts
   git commit -m "Fix: Pass user data from JWT token to createLobby to avoid database lookup"
   git push
   ```

2. **On the production server:**
   ```bash
   # Pull the latest changes
   git pull

   # Rebuild and restart
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml build backend
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend
   ```

## Testing
After deployment, test the fix by:

1. Log in to the application at `https://l2p.korczewski.de`
2. Try to create a new lobby
3. Verify that the lobby is created successfully without the "User not found" error

## Benefits
- ✅ Eliminates unnecessary database queries for authenticated users
- ✅ Fixes the "User not found" error for OAuth users
- ✅ Maintains backward compatibility with legacy users
- ✅ Improves performance by using data already available in the JWT token
- ✅ Reduces coupling between the L2P service and the centralized auth service database
