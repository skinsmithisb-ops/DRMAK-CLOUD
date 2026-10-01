







export type UserRole = 'Admin' | 'Doctor' | 'Receptionist' | 'Sales' | 'Social Media Manager' | 'Operations Manager' | 'Designer' | 'Guest';

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
  isAdmin?: boolean;
  isMainAdmin?: boolean;
  featureAccess?: { [key: string]: boolean };
  icon?: string;
  doctorId?: string; // Linked doctor profile ID
  status?: string;
  isDeleted?: boolean;
  active?: boolean;
};

export type Doctor = {
  id: string;
  fullName: string;
  specialization: string;
  qualification: string;
  consultationFees: number;
  availableDays: string[];
  availableTimings: string;
  avatarUrl: string;
  prescriptionTemplateUrl?: string;
  useCustomPrescription?: boolean;
};

export type Patient = {
  id: string; // This will be the document ID from Firestore
  mobileNumber: string; // This is the mobileNumber field
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  address?: string;
  avatarUrl: string;
  salutation?: string;
  guardianName?: string;
  assignedDoctorId?: string;
  reasonForVisit?: string;
  registrationDate?: string; // ISO string
  referredBy?: string;
  maritalStatus?: 'Married' | 'Unmarried';
  status?: 'Active' | 'Inactive';
  smsPreference?: 'English' | 'Urdu';
  deceased?: boolean;
  lastComment?: string;
  lastCommentDate?: string; // ISO string
};

export type PatientComment = {
  id: string;
  patientId: string;
  comment: string;
  addedBy: string; // User Name
  addedByRole: string; // User Role
  createdAt: string; // ISO string
};

export type Appointment = {
  id: string;
  patientMobileNumber: string;
  doctorId: string;
  appointmentDateTime: string; // ISO string
  status: 'Waiting' | 'In Consultation' | 'Completed' | 'Cancelled' | 'No Show' | 'Checked In' | 'Confirmed';
  procedure?: string;
  comments?: string;
  // The following fields will be enriched after fetching
  patient?: Patient;
  doctor?: Doctor;
};

export type VisitRecord = {
  id: string;
  appointmentId: string;
  appointmentDate: string; // ISO String
  diagnosis: string;
  prescribedMedicines?: string[];
  proceduresTreatments?: string[];
  doctorNotes?: string;
  // Enriched fields
  patient?: Patient;
  doctor?: Doctor;
};

export type FamilyHistory = {
  id: string;
  patientId: string;
  relativeName: string;
  gender: 'Male' | 'Female' | 'Other';
  relationship: string;
  bloodGroup?: string;
  remarks?: string;
};

export type MedicalHistory = {
  id: string;
  patientId: string;
  text: string;
  type: 'History' | 'Alert' | 'Suggestion';
  createdAt: string; // ISO string
}

export type HealthRecord = {
  id: string;
  patientId: string;
  userId: string;
  recordDate: string; // ISO string
  complaint?: string;
  diagnosis?: string;
  clinicalNotes?: string;
  advice?: string;
  investigation?: string;
  plan?: string;
  procedures?: string[];
  followUpDate?: string; // ISO string
};


export type PharmacyItem = {
  id: string;
  productName: string;
  name?: string;
  genericName?: string;
  barcode?: string;
  category: string;
  manufacturer?: string;
  supplier: string;
  unit?: string;
  stockingUnit?: number;
  conversionUnit?: number;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  minThreshold?: number;
  expiryDate: string; // ISO string
  active: boolean;
  rack?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';
  supplierId?: string;
};

export type Visit = {
  id: string;
  date: string;
  doctor: Doctor;
  diagnosis: string;
  prescription: { medicine: string; dosage: string }[];
  procedures: string[];
  notes: string;
  billed: boolean;
};

export type BillingRecord = {
  id: string;
  patientMobileNumber?: string;
  patientMobile?: string;   // alias used in some records
  patientName?: string;
  patientId?: string;
  consultationCharges?: number;
  procedureCharges?: number;
  medicineCharges?: number;
  grandTotal?: number;
  totalAmount?: number;
  subTotal?: number;
  discountAmount?: number;
  paymentMethod: string;
  billingDate?: string;  // ISO String — legacy field
  timestamp?: string;   // ISO String — actual field saved by billing module
  status?: string;
  items?: Array<{ id: string; name: string; type: string; price: number; qty: number }>;
}


export type PharmacyRack = {
  id: string;
  name: string;
  createdAt: { seconds: number, nanoseconds: number };
  items: string[];
}

export type StockEntry = {
  id: string;
  supplier: string;
  supplierId?: string;
  document: string;
  sku: number;
  createdAt: string;
  supplierInvoiceDate: string;
  supplierInvoice: string;
  items: StockItem[];
}

export type StockItem = {
  sr: number;
  itemName: string;
  manufacturer: string;
  category: string;
  conversionUnit: number;
  totalQty: number;
  qtyInUnits: number;
  unit: string;
  unitCost: number;
  unitCostWithTax: number;
  discountedPrice: number;
  netUnitCost: number;
  totalCost: number;
}

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'New Lead' | 'In Progress' | 'Dead' | 'Converted' | 'Previous';
  source: string;
  assignedTo: string;
  createdAt: string;
  product?: string; // What the client wants
  isOnlineOnly?: boolean; // Flag for Google Sheet leads
};

export type DailyReport = {
  id: string;
  userId: string;
  reportDate: string; // ISO string
  summary: string;
  plans: string;
  completingTasks?: string;
}

export type DailyTask = {
  id: string;
  userId: string;
  task: string;
  status: 'Pending' | 'Completed';
  dueDate: string; // ISO string
};

export type DailyPosting = {
  id: string;
  userId: string;
  platform: 'Instagram' | 'Facebook' | 'WhatsApp' | 'TikTok' | 'Other';
  activityType: 'Post' | 'Story' | 'Reel' | 'Video';
  description: string;
  link?: string;
  screenshotUrl?: string; // URL of the uploaded proof/screenshot
  postedAt: string; // ISO string
};

export type SocialReport = {
  id: string;
  userId: string;
  reportDate: string; // ISO string
  summary: string;
  metrics: string;
  plans: string;
};

export type SocialReach = {
  id: string;
  userId: string;
  date: string; // ISO date
  platform: 'Instagram' | 'Facebook' | 'WhatsApp' | 'TikTok' | 'Other';
  reach: number;
  engagement?: number;
  followers?: number;
};

export type SocialSettings = {
  userId: string;
  googleSheetLink?: string;
};

export type DesignerWork = {
  id: string;
  userId: string;
  date: string; // ISO date
  assetType: 'Post Graphic' | 'Story Design' | 'Youtube Thumbnail' | 'Banner' | 'Reel Edit' | 'Other';
  title: string;
  link?: string;
  status: 'Draft' | 'Sent for Review' | 'Approved' | 'Published';
};

export type ScheduledPost = {
  id: string;
  userId: string;
  title: string;
  platform: 'Instagram' | 'Facebook' | 'WhatsApp' | 'TikTok' | 'YouTube' | 'Other';
  scheduledAt: string; // ISO date-time
  status: 'Draft' | 'Scheduled' | 'Published';
  description?: string;
  imageUrl?: string;
};

export type AdminTaskTemplate = {
  id: string;
  content: string; // Task description
  category: string; // e.g., "Sales", "Social Media", "General"
  assignedTo: string; // userId or "all" for all users
  createdAt: string; // ISO string
  createdBy: string; // Admin userId
};

export type InvoiceItem = {
  id: string;
  procedure: string;
  description: string;
  rate: number;
  quantity: number;
  amount: number;
  discount: number;
  performedBy: string;
};

export type Invoice = {
  id: string;
  patientId: string;
  patientMobileNumber: string;
  invoiceDate: string; // ISO string
  items: InvoiceItem[];
  subTotal: number;
  totalDiscount: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  status: 'Paid' | 'Pending' | 'Cancelled';
  notes?: string;
};

export type Communication = {
  id: string;
  patientId: string;
  message: string;
  service: string;
  sentBy: string;
  sentAt: string; // ISO string
};

export type TreatmentPlan = {
  id: string;
  patientId: string;
  procedure: string;
  total: number;
  scheduleDate: string; // ISO string
  addedBy: string; // User ID
  createdDate: string; // ISO string
  modifiedDate: string; // ISO string
};

export type FeatureAccess = {
  id: string;
  role: UserRole;
  features: { [key: string]: boolean };
};

export type ChatType = 'individual' | 'group';

export type Chat = {
  id: string;
  type: ChatType;
  participants: string[];
  name?: string; // For group chats
  avatarUrl?: string; // For group chats
  lastMessage?: string;
  lastMessageAt?: string; // ISO string
  lastSenderId?: string; // ID of the user who sent the last message
  readBy?: string[]; // IDs of users who have read the latest message in this chat
  createdAt: string; // ISO string
  createdBy: string; // User ID
};

export type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: string; // ISO string
  type: 'text' | 'image' | 'file';
  readBy?: string[]; // Array of user IDs who have read the message
};

export type DesignRequest = {
  id: string;
  requesterId: string;
  title: string;
  description: string;
  assetType: DesignerWork['assetType'];
  status: 'Pending' | 'In Progress' | 'Submitted' | 'Approved' | 'Rejected';
  submissionUrl?: string; // Image, Video link or URL
  deadline?: string; // ISO string
  createdAt: string; // ISO string
  assignedTo?: string; // Designer ID
};

export type SalesTraining = {
  id: string;
  title: string;
  content: string; // Rich text/markdown content with headings
  videoUrl?: string;
  createdAt: string; // ISO string
  createdBy: string; // Admin userId
};

export type SalesTrainingCompletion = {
  id: string; // userId_trainingId
  userId: string;
  trainingId: string;
  completedAt: string; // ISO string
};

export type FollowUp = {
  id: string;
  patientId: string;
  patientName: string;
  patientMobile: string;
  followUpDate: string; // ISO string
  reason?: string;
  notes?: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  createdAt: string; // ISO string
  callOutcome?: string;
  calledBy?: string;
  calledByRole?: string;
  remarks?: string;
}

export type SupplierType = 'Vendor' | 'Distributor';

export type SupplierProduct = {
  id: string;
  name: string;
  price?: number; // Purchase Price
  purchasePrice?: number;
  sellingPrice: number;
  quantity: number;
  minThreshold: number;
  rack?: string;
  expiryDate?: string;
  alternatives?: string[]; // Array of product IDs
  category?: string;
};

export type Supplier = {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  category: string;
  status: 'Active' | 'Inactive';
  notes: string;
  createdAt: string;
  type: SupplierType;
  // Vendor specific (Product-to-Product)
  products?: SupplierProduct[];
  // Distributor specific (Bill-to-Bill)
  openingBalance?: number;
  currentBalance?: number;
  creditLimit?: number;
};

export type SocialCost = {
  id: string;
  month: string; // "January", "February", etc.
  year: number;
  adSpend: number;
  boostingSpend: number;
  prSpend: number;
  otherSpend: number;
  totalSpent: number;
  notes?: string;
  updatedAt: string; // ISO string
  updatedBy: string; // User ID
};

export type SocialROAS = {
  id: string; // format: "January_2026"
  month: string; // "January", "February", etc.
  year: number;
  // Spend (pulled from socialCosts or entered manually)
  totalAdSpend: number;
  // Funnel metrics
  leadsGenerated: number;
  leadsConverted: number;
  revenueFromConversions: number;
  // Auto-calculated fields (stored for convenience)
  costPerLead: number;        // totalAdSpend / leadsGenerated
  costPerConversion: number;  // totalAdSpend / leadsConverted
  conversionRate: number;     // (leadsConverted / leadsGenerated) * 100
  roas: number;               // revenueFromConversions / totalAdSpend
  // Meta
  notes?: string;
  updatedAt: string; // ISO string
  updatedBy: string; // User ID
};

export type VendorTransaction = {
  id: string;
  supplierId: string;
  supplierName: string;
  type: 'Bill' | 'Payment';
  amount: number;
  date: string;
  reference?: string;
  notes?: string;
  medicines?: string[];
  invoiceImageUrl?: string;
  addedBy: string;
  createdAt: string;
};
