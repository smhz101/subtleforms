/**
 * SubtleForms SDK TypeScript Definitions
 * 
 * Type definitions for SubtleForms Extension SDK v1.0.0
 * 
 * @packageDocumentation
 */

declare module '@subtleforms/sdk' {
  // ============================================================================
  // Extension Registration
  // ============================================================================
  
  export interface ExtensionConfig {
    /** Unique extension ID (reverse domain notation, e.g., "com.example.analytics") */
    id: string;
    /** Human-readable extension name */
    name: string;
    /** Semantic version (e.g., "1.0.0") */
    version: string;
    /** Brief description of extension functionality */
    description?: string;
    /** Initialization callback */
    initialize?: () => void;
    /** Cleanup callback */
    cleanup?: () => void;
    /** Required core features */
    requires?: string[];
  }
  
  export interface ExtensionAPI {
    /** Register a hook for this extension */
    addHook: (hookName: string, callback: Function, priority?: number) => () => void;
    /** Register a builder lifecycle hook */
    addBuilderHook: (hookName: string, callback: Function, priority?: number) => () => void;
    /** Register a UI extension slot */
    addUISlot: (slotName: string, component: React.ComponentType<any>, options?: UISlotOptions) => () => void;
    /** Register a custom capability */
    addCapability: (capabilityKey: string, config: CapabilityConfig) => () => void;
    /** Unregister this extension */
    unregister: () => void;
  }
  
  export function registerExtension(config: ExtensionConfig): ExtensionAPI;
  export function getRegisteredExtensions(): ExtensionInfo[];
  export function isExtensionRegistered(extensionId: string): boolean;
  
  export interface ExtensionInfo {
    id: string;
    name: string;
    version: string;
    description: string;
    registered: number;
    hooks: number;
    uiSlots: number;
    capabilities: number;
  }
  
  // ============================================================================
  // Hook System
  // ============================================================================
  
  export function registerHook(
    hookName: string,
    callback: (...args: any[]) => any,
    priority?: number
  ): () => void;
  
  export function doAction(hookName: string, ...args: any[]): Promise<void>;
  export function applyFilters<T>(hookName: string, value: T, ...args: any[]): Promise<T>;
  export function hasHook(hookName: string): boolean;
  export function getRegisteredHooks(): string[];
  
  // ============================================================================
  // Builder Hooks
  // ============================================================================
  
  export function registerBuilderHook(
    hookName: string,
    callback: Function,
    priority?: number
  ): () => void;
  
  export const BUILDER_HOOKS: {
    BEFORE_FIELD_INSERT: 'beforeFieldInsert';
    AFTER_FIELD_INSERT: 'afterFieldInsert';
    BEFORE_FIELD_DELETE: 'beforeFieldDelete';
    AFTER_FIELD_DELETE: 'afterFieldDelete';
    BEFORE_FIELD_UPDATE: 'beforeFieldUpdate';
    AFTER_FIELD_UPDATE: 'afterFieldUpdate';
    BEFORE_FIELD_MOVE: 'beforeFieldMove';
    AFTER_FIELD_MOVE: 'afterFieldMove';
    BEFORE_FIELD_DUPLICATE: 'beforeFieldDuplicate';
    AFTER_FIELD_DUPLICATE: 'afterFieldDuplicate';
    BEFORE_SAVE: 'beforeSave';
    AFTER_SAVE: 'afterSave';
    BEFORE_VALIDATE: 'beforeValidate';
    AFTER_VALIDATE: 'afterValidate';
    FIELD_SELECTED: 'fieldSelected';
    FIELD_DESELECTED: 'fieldDeselected';
  };
  
  // ============================================================================
  // UI Slots
  // ============================================================================
  
  export interface UISlotOptions {
    priority?: number;
    shouldRender?: (context: any) => boolean;
  }
  
  export function registerUISlot(
    slotName: string,
    component: React.ComponentType<any>,
    options?: UISlotOptions
  ): () => void;
  
  export const UISlot: React.FC<{
    name: string;
    context?: any;
    fallback?: React.ReactNode;
  }>;
  
  export const UI_SLOTS: {
    BUILDER_TOOLBAR_ACTIONS: 'builder.toolbar.actions';
    BUILDER_SIDEBAR_TOP: 'builder.sidebar.top';
    BUILDER_SIDEBAR_BOTTOM: 'builder.sidebar.bottom';
    BUILDER_INSPECTOR_FIELD: 'builder.inspector.field';
    FORMS_LIST_ACTIONS: 'forms.list.actions';
    FORMS_LIST_COLUMNS: 'forms.list.columns';
    TEMPLATES_CATEGORIES: 'templates.categories';
    SETTINGS_TABS: 'settings.tabs';
  };
  
  // ============================================================================
  // Custom Capabilities
  // ============================================================================
  
  export interface CapabilityConfig {
    description: string;
    check?: (license: any) => boolean;
    upgradeMessage?: string;
  }
  
  export function registerCapability(
    capabilityKey: string,
    config: CapabilityConfig
  ): () => void;
  
  export function hasCustomCapability(capabilityKey: string): boolean;
  export function getCustomCapability(capabilityKey: string): CapabilityConfig | null;
  
  // ============================================================================
  // Policy Layer
  // ============================================================================
  
  export interface AbilityResult {
    can: boolean;
    loading: boolean;
    ready: boolean;
    reason?: string;
    upgrade?: boolean;
    gracePeriod?: boolean;
    error?: boolean;
    custom?: boolean;
  }
  
  export function useAbility(capabilityKey: string): AbilityResult;
  export function getUpgradeMessage(capabilityKey: string): string;
  
  export const Can: React.FC<{
    do: string;
    fallback?: React.ReactNode;
    loading?: React.ReactNode;
    children: React.ReactNode;
  }>;
  
  export const Cannot: React.FC<{
    do: string;
    fallback?: React.ReactNode;
    loading?: React.ReactNode;
    children: React.ReactNode;
  }>;
  
  // ============================================================================
  // Data Hooks
  // ============================================================================
  
  export function useForms(): {
    data: any;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };
  
  export function useForm(formId: number | string): {
    data: any;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };
  
  export function useTemplates(): {
    data: any;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };
  
  export function useLicense(): {
    data: any;
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
  };
  
  // ============================================================================
  // SDK Metadata
  // ============================================================================
  
  export const SDK_VERSION: string;
  export const EXTENSION_API_VERSION: string;
  export const MIN_WP_VERSION: string;
  export const MIN_PHP_VERSION: string;
  
  export const SDK_FEATURES: {
    hooks: boolean;
    builderHooks: boolean;
    uiSlots: boolean;
    customCapabilities: boolean;
    dataHooks: boolean;
    submissionHooks: boolean;
    customFieldTypes: boolean;
    restEndpoints: boolean;
  };
  
  export interface CompatibilityResult {
    compatible: boolean;
    reason?: string;
    version?: string;
    features?: typeof SDK_FEATURES;
  }
  
  export function checkSDKCompatibility(
    requiredVersion: string,
    requiredFeatures?: string[]
  ): CompatibilityResult;
  
  export function getSDKInfo(): {
    version: string;
    apiVersion: string;
    features: typeof SDK_FEATURES;
    wordpress: { minVersion: string };
    php: { minVersion: string };
  };
}
