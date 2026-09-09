export interface PlanFeature {
    name: string;
    is_included: boolean;
}

export interface Plan {
    id: number;
    name: string;
    price: string;
    currency: string;
    is_active: boolean;
    description: string | null;
    features: PlanFeature[];
}

export interface CreatePlanPayload {
    name: string;
    price: number;
    currency?: string | undefined;
    is_active?: boolean | undefined;
    description?: string | null | undefined;
    features?: PlanFeature[] | undefined;
}

export interface UpdatePlanPayload {
    name?: string | undefined;
    price?: number | undefined;
    currency?: string | undefined;
    is_active?: boolean | undefined;
    description?: string | null | undefined;
    features?: PlanFeature[] | undefined;
}
