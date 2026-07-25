import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

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

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;
export function createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface GetMyCartRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyCartData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyCartData, undefined>;
  operationName: string;
}
export const getMyCartRef: GetMyCartRef;

export function getMyCart(options?: ExecuteQueryOptions): QueryPromise<GetMyCartData, undefined>;
export function getMyCart(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyCartData, undefined>;

interface AddToCartRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddToCartVariables): MutationRef<AddToCartData, AddToCartVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddToCartVariables): MutationRef<AddToCartData, AddToCartVariables>;
  operationName: string;
}
export const addToCartRef: AddToCartRef;

export function addToCart(vars: AddToCartVariables): MutationPromise<AddToCartData, AddToCartVariables>;
export function addToCart(dc: DataConnect, vars: AddToCartVariables): MutationPromise<AddToCartData, AddToCartVariables>;

interface ListAvailableProductsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAvailableProductsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListAvailableProductsData, undefined>;
  operationName: string;
}
export const listAvailableProductsRef: ListAvailableProductsRef;

export function listAvailableProducts(options?: ExecuteQueryOptions): QueryPromise<ListAvailableProductsData, undefined>;
export function listAvailableProducts(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListAvailableProductsData, undefined>;

