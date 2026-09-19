import { CreateUserData, CreateUserVariables, GetMyCartData, AddToCartData, AddToCartVariables, ListAvailableProductsData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateUser(options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, CreateUserVariables>): UseDataConnectMutationResult<CreateUserData, CreateUserVariables>;
export function useCreateUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, CreateUserVariables>): UseDataConnectMutationResult<CreateUserData, CreateUserVariables>;

export function useGetMyCart(options?: useDataConnectQueryOptions<GetMyCartData>): UseDataConnectQueryResult<GetMyCartData, undefined>;
export function useGetMyCart(dc: DataConnect, options?: useDataConnectQueryOptions<GetMyCartData>): UseDataConnectQueryResult<GetMyCartData, undefined>;

export function useAddToCart(options?: useDataConnectMutationOptions<AddToCartData, FirebaseError, AddToCartVariables>): UseDataConnectMutationResult<AddToCartData, AddToCartVariables>;
export function useAddToCart(dc: DataConnect, options?: useDataConnectMutationOptions<AddToCartData, FirebaseError, AddToCartVariables>): UseDataConnectMutationResult<AddToCartData, AddToCartVariables>;

export function useListAvailableProducts(options?: useDataConnectQueryOptions<ListAvailableProductsData>): UseDataConnectQueryResult<ListAvailableProductsData, undefined>;
export function useListAvailableProducts(dc: DataConnect, options?: useDataConnectQueryOptions<ListAvailableProductsData>): UseDataConnectQueryResult<ListAvailableProductsData, undefined>;
