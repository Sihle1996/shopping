export interface TenantDto {
  id: string
  name: string
  slug: string
  logoUrl?: string
  primaryColor?: string
  email?: string
  phone?: string
  address?: string
  deliveryRadiusKm: number
  deliveryFeeBase: number
  platformCommissionPercent: number
  subscriptionStatus?: string
  subscriptionPlan?: string
  active: boolean
  createdAt: string
  userCount: number
  driverCount: number
  orderCount: number
  revenue: number
  trialStartedAt?: string
  trialDaysRemaining?: number
}

export interface UserDto {
  id: string
  email: string
  role: string
  driverStatus?: string
  tenantId?: string
  tenantName?: string
  lastPing?: string
}

export interface StatsDto {
  totalStores: number
  activeStores: number
  totalUsers: number
  totalDrivers: number
  totalOrders: number
  totalRevenue: number
  pendingOrders: number
}

export interface SubscriptionPlanDto {
  id: string
  name: string
  price: number
  maxMenuItems: number
  maxDrivers: number
  maxPromotions: number
  maxDeliveryRadiusKm: number
  hasAnalytics: boolean
  hasCustomBranding: boolean
  hasInventoryExport: boolean
  commissionPercent: number
  features?: string
  createdAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface StoreQueryParams {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface UserQueryParams {
  search?: string
  role?: string
  page?: number
  pageSize?: number
}

export interface DriverQueryParams {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface OrderDto {
  id: string
  status: string
  totalAmount: number
  orderDate: string
  tenantId?: string
  storeName: string
}

export interface OrderQueryParams {
  search?: string
  status?: string
  storeId?: string
  page?: number
  pageSize?: number
}

export interface CreateStoreDto {
  name: string
  slug: string
  email?: string
  phone?: string
  subscriptionPlan?: string
  subscriptionStatus?: string
}

export interface PlatformSettingsDto {
  commissionRatePercent: number
  supportEmail: string
  defaultTrialDays: number
  allowSelfRegistration: boolean
  updatedAt: string
}

export interface UpdateStoreDto {
  name?: string
  subscriptionStatus?: string
  subscriptionPlan?: string
  active?: boolean
  platformCommissionPercent?: number
  deliveryRadiusKm?: number
}

export interface UpdateUserDto {
  role?: string
  driverStatus?: string
}

export interface CreatePlanDto {
  name: string
  price: number
  maxMenuItems: number
  maxDrivers: number
  maxPromotions: number
  maxDeliveryRadiusKm: number
  hasAnalytics: boolean
  hasCustomBranding: boolean
  hasInventoryExport: boolean
  commissionPercent: number
  features?: string
}

export interface UpdatePlanDto {
  name?: string
  price?: number
  maxMenuItems?: number
  maxDrivers?: number
  maxPromotions?: number
  maxDeliveryRadiusKm?: number
  hasAnalytics?: boolean
  hasCustomBranding?: boolean
  hasInventoryExport?: boolean
  commissionPercent?: number
  features?: string
}

export interface SubscriptionHealthDto {
  expiringTrials: { id: string; name: string; slug: string; email?: string; daysRemaining: number }[]
  monthlyRevenueForecast: number
  planDistribution: { plan: string; count: number }[]
}

export type DocumentType = 'CIPC' | 'COA' | 'BANK_DETAILS' | 'STOREFRONT_PHOTO'
export type DocumentStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export interface StoreDocumentDto {
  id: string
  documentType: DocumentType
  fileUrl: string
  fileName: string
  status: DocumentStatus
  reviewNotes?: string
  uploadedAt: string
}

export interface PendingEnrollmentDto {
  id: string
  name: string
  slug: string
  email?: string
  phone?: string
  address?: string
  submittedAt: string
  cipcNumber?: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountType?: string
  bankBranchCode?: string
  documents: StoreDocumentDto[]
}
