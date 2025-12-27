# L2P Perks System Implementation Plan

## 🎯 **System Architecture Overview**

### **Core Components**
1. **PerksManager Service** - Backend service for perk logic and validation
2. **Perks Database Schema** - Store available perks, user unlocks, and configurations
3. **PerksConfigUI Component** - Frontend interface for managing perks
4. **Character Service Integration** - Link perks to character progression
5. **Game Service Integration** - Apply active perks during gameplay

## 📊 **Database Schema Design**

### **Tables to Create/Modify**
```sql
-- Available perks registry
CREATE TABLE perks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- 'cosmetic', 'social', 'qol', 'audio'
    type VARCHAR(50) NOT NULL, -- 'avatar', 'badge', 'theme', 'sound'
    level_required INTEGER NOT NULL,
    description TEXT,
    config_schema JSONB, -- Defines what options the perk has
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User perk unlocks and configurations
CREATE TABLE user_perks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    perk_id INTEGER REFERENCES perks(id) ON DELETE CASCADE,
    is_unlocked BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT false,
    configuration JSONB, -- User's custom configuration for this perk
    unlocked_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, perk_id)
);

-- Add perks-related fields to users table
ALTER TABLE users 
ADD COLUMN active_avatar VARCHAR(50) DEFAULT 'student',
ADD COLUMN active_badge VARCHAR(50),
ADD COLUMN active_theme VARCHAR(50) DEFAULT 'default',
ADD COLUMN perks_config JSONB DEFAULT '{}';
```

## 🎨 **Implementation Order & Milestones**

### **Phase 1: Foundation (Milestone 1)**
1. ✅ Create database migrations for perks system
2. ✅ Implement PerksManager service with basic CRUD operations
3. ✅ Add perks seeding data for initial perks
4. ✅ Write unit tests for PerksManager

### **Phase 2: First Perk - Custom Character Avatars (Milestone 2)**
1. ✅ Implement avatar perk logic (unlocked at Level 5)
2. ✅ Create avatar selection UI component
3. ✅ Add avatar assets (Scientist, Explorer, Artist)
4. ✅ Integrate with character service
5. ✅ Write E2E tests for avatar switching

### **Phase 3: Second Perk - Custom Profile Badges (Milestone 3)**
1. ✅ Implement badge perk logic (unlocked at Level 3)
2. ✅ Create badge collection and selection UI
3. ✅ Add badge assets and designs
4. ✅ Display badges in user profiles and lobbies
5. ✅ Write tests for badge system

### **Phase 4: Perks Configuration UI (Milestone 4)**
1. ✅ Create comprehensive perks management interface
2. ✅ Implement perk activation/deactivation
3. ✅ Add detailed configuration options for each perk
4. ✅ Create "loadout" saving and management
5. ✅ Add accessibility features

### **Phase 5: Integration & Polish (Milestone 5)**
1. ✅ Integrate perks with existing game flows
2. ✅ Add perk unlock notifications
3. ✅ Performance optimization for perk checking
4. ✅ Comprehensive testing across all features
5. ✅ Documentation and user guides

## 🔧 **Technical Implementation Details**

### **Perks Manager Service API**
```typescript
interface PerksManagerAPI {
  // Core operations
  getUserPerks(userId: number): Promise<UserPerk[]>
  unlockPerk(userId: number, perkId: number): Promise<boolean>
  activatePerk(userId: number, perkId: number, config?: any): Promise<boolean>
  deactivatePerk(userId: number, perkId: number): Promise<boolean>
  
  // Configuration
  configurePerk(userId: number, perkId: number, config: any): Promise<boolean>
  getActiveLoadout(userId: number): Promise<UserLoadout>
  saveLoadout(userId: number, name: string, config: any): Promise<boolean>
  
  // Validation
  canUnlockPerk(userId: number, perkId: number): Promise<boolean>
  validatePerkConfig(perkId: number, config: any): boolean
}
```

### **Frontend Integration Points**
- **Character Selection**: Avatar perks integration
- **Profile Page**: Badge and customization display
- **Settings Page**: Main perks configuration interface
- **Lobby Interface**: Show active perks to other players
- **Game Interface**: Apply visual/audio perks during gameplay

## 📋 **Specific Perks Implementation Details**

### **Perk 1: Custom Character Avatars (Level 5)**
- **Assets**: 4 additional avatars beyond default 'student'
- **Storage**: `users.active_avatar` field
- **UI**: Avatar selection grid in profile settings
- **Validation**: User level >= 5 to unlock/use

### **Perk 2: Custom Profile Badges (Level 3)**
- **Assets**: 8-10 different badge designs
- **Storage**: `users.active_badge` field + badge collection in user_perks
- **UI**: Badge showcase in profile, selection interface
- **Validation**: User level >= 3 to unlock first badge

### **Perk 3: Custom UI Themes (Level 10)**
- **Assets**: CSS theme variables for different color schemes
- **Storage**: `users.active_theme` field
- **UI**: Theme preview and selection interface
- **Integration**: Dynamic CSS class application

## 🧪 **Testing Strategy**

### **Unit Tests**
- PerksManager service methods
- Perk unlock validation logic
- Configuration validation
- Database operations

### **Integration Tests**
- User progression triggering perk unlocks
- Perk activation affecting game behavior
- Configuration persistence across sessions

### **E2E Tests**
- Complete perk unlock and configuration flow
- Visual verification of active perks
- Multi-user perk interaction testing

## 📈 **Performance Considerations**
- Cache active perks in Redis for quick access
- Lazy load perk assets only when needed
- Batch perk validation operations
- Optimize database queries with proper indexing

## 🔒 **Security & Validation**
- Server-side validation for all perk operations
- Rate limiting on perk configuration changes
- Prevent perk spoofing or unauthorized unlocks
- Audit trail for perk-related actions

## 🚀 **Future Expansion Plans**
- Seasonal/limited-time perks
- Achievement-based perk unlocks
- Prestige system integration
- Community-created perks system
- Perk trading/gifting system

---

**Current Status**: Phase 1 - Foundation
**Next Milestone**: Database schema and PerksManager service
**Estimated Completion**: Phase 1-3 within development session