import { ConnectorConfig, DataConnect, OperationOptions, ExecuteOperationResponse } from 'firebase-admin/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export interface AddToCartData {
  cartItem_insert: CartItem_Key;
}

export interface AddToCartVariables {
  cartId: UUIDString;
  productId: UUIDString;
  quantity: number;
}

export interface CartItem_Key {
  id: UUIDString;
  __typename?: 'CartItem_Key';
}

export interface Cart_Key {
  id: UUIDString;
  __typename?: 'Cart_Key';
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface CreateUserVariables {
  email: string;
  fullName: string;
}

export interface GetMyCartData {
  carts: ({
    id: UUIDString;
    cartItems_on_cart: ({
      product: {
        name: string;
        price: number;
      };
      quantity: number;
    })[];
  } & Cart_Key)[];
}

export interface ListAvailableProductsData {
  products: ({
    name: string;
    price: number;
    description?: string | null;
    imageUrl?: string | null;
  })[];
}

export interface OrderItem_Key {
  id: UUIDString;
  __typename?: 'OrderItem_Key';
}

export interface Order_Key {
  id: UUIDString;
  __typename?: 'Order_Key';
}

export interface Product_Key {
  id: UUIDString;
  __typename?: 'Product_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to execute without passing in DataConnect. */
export function createUser(dc: DataConnect, vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;
/** Generated Node Admin SDK operation action function for the 'CreateUser' Mutation. Allow users to pass in custom DataConnect instances. */
export function createUser(vars: CreateUserVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<CreateUserData>>;

/** Generated Node Admin SDK operation action function for the 'GetMyCart' Query. Allow users to execute without passing in DataConnect. */
export function getMyCart(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyCartData>>;
/** Generated Node Admin SDK operation action function for the 'GetMyCart' Query. Allow users to pass in custom DataConnect instances. */
export function getMyCart(options?: OperationOptions): Promise<ExecuteOperationResponse<GetMyCartData>>;

/** Generated Node Admin SDK operation action function for the 'AddToCart' Mutation. Allow users to execute without passing in DataConnect. */
export function addToCart(dc: DataConnect, vars: AddToCartVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddToCartData>>;
/** Generated Node Admin SDK operation action function for the 'AddToCart' Mutation. Allow users to pass in custom DataConnect instances. */
export function addToCart(vars: AddToCartVariables, options?: OperationOptions): Promise<ExecuteOperationResponse<AddToCartData>>;

/** Generated Node Admin SDK operation action function for the 'ListAvailableProducts' Query. Allow users to execute without passing in DataConnect. */
export function listAvailableProducts(dc: DataConnect, options?: OperationOptions): Promise<ExecuteOperationResponse<ListAvailableProductsData>>;
/** Generated Node Admin SDK operation action function for the 'ListAvailableProducts' Query. Allow users to pass in custom DataConnect instances. */
export function listAvailableProducts(options?: OperationOptions): Promise<ExecuteOperationResponse<ListAvailableProductsData>>;

