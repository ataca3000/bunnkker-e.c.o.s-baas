# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `default`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetMyCart*](#getmycart)
  - [*ListAvailableProducts*](#listavailableproducts)
- [**Mutations**](#mutations)
  - [*CreateUser*](#createuser)
  - [*AddToCart*](#addtocart)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `default`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetMyCart
You can execute the `GetMyCart` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyCart(options?: ExecuteQueryOptions): QueryPromise<GetMyCartData, undefined>;

interface GetMyCartRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyCartData, undefined>;
}
export const getMyCartRef: GetMyCartRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyCart(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyCartData, undefined>;

interface GetMyCartRef {
  ...
  (dc: DataConnect): QueryRef<GetMyCartData, undefined>;
}
export const getMyCartRef: GetMyCartRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyCartRef:
```typescript
const name = getMyCartRef.operationName;
console.log(name);
```

### Variables
The `GetMyCart` query has no variables.
### Return Type
Recall that executing the `GetMyCart` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyCartData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetMyCart`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyCart } from '@dataconnect/generated';


// Call the `getMyCart()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyCart();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyCart(dataConnect);

console.log(data.carts);

// Or, you can use the `Promise` API.
getMyCart().then((response) => {
  const data = response.data;
  console.log(data.carts);
});
```

### Using `GetMyCart`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyCartRef } from '@dataconnect/generated';


// Call the `getMyCartRef()` function to get a reference to the query.
const ref = getMyCartRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyCartRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.carts);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.carts);
});
```

## ListAvailableProducts
You can execute the `ListAvailableProducts` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listAvailableProducts(options?: ExecuteQueryOptions): QueryPromise<ListAvailableProductsData, undefined>;

interface ListAvailableProductsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListAvailableProductsData, undefined>;
}
export const listAvailableProductsRef: ListAvailableProductsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listAvailableProducts(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListAvailableProductsData, undefined>;

interface ListAvailableProductsRef {
  ...
  (dc: DataConnect): QueryRef<ListAvailableProductsData, undefined>;
}
export const listAvailableProductsRef: ListAvailableProductsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listAvailableProductsRef:
```typescript
const name = listAvailableProductsRef.operationName;
console.log(name);
```

### Variables
The `ListAvailableProducts` query has no variables.
### Return Type
Recall that executing the `ListAvailableProducts` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListAvailableProductsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListAvailableProductsData {
  products: ({
    name: string;
    price: number;
    description?: string | null;
    imageUrl?: string | null;
  })[];
}
```
### Using `ListAvailableProducts`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listAvailableProducts } from '@dataconnect/generated';


// Call the `listAvailableProducts()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listAvailableProducts();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listAvailableProducts(dataConnect);

console.log(data.products);

// Or, you can use the `Promise` API.
listAvailableProducts().then((response) => {
  const data = response.data;
  console.log(data.products);
});
```

### Using `ListAvailableProducts`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listAvailableProductsRef } from '@dataconnect/generated';


// Call the `listAvailableProductsRef()` function to get a reference to the query.
const ref = listAvailableProductsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listAvailableProductsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.products);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.products);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateUser
You can execute the `CreateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserRef:
```typescript
const name = createUserRef.operationName;
console.log(name);
```

### Variables
The `CreateUser` mutation requires an argument of type `CreateUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateUserVariables {
  email: string;
  fullName: string;
}
```
### Return Type
Recall that executing the `CreateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserData {
  user_insert: User_Key;
}
```
### Using `CreateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUser, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  email: ..., 
  fullName: ..., 
};

// Call the `createUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUser(createUserVars);
// Variables can be defined inline as well.
const { data } = await createUser({ email: ..., fullName: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUser(dataConnect, createUserVars);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
createUser(createUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `CreateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserRef, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  email: ..., 
  fullName: ..., 
};

// Call the `createUserRef()` function to get a reference to the mutation.
const ref = createUserRef(createUserVars);
// Variables can be defined inline as well.
const ref = createUserRef({ email: ..., fullName: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserRef(dataConnect, createUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## AddToCart
You can execute the `AddToCart` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addToCart(vars: AddToCartVariables): MutationPromise<AddToCartData, AddToCartVariables>;

interface AddToCartRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddToCartVariables): MutationRef<AddToCartData, AddToCartVariables>;
}
export const addToCartRef: AddToCartRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addToCart(dc: DataConnect, vars: AddToCartVariables): MutationPromise<AddToCartData, AddToCartVariables>;

interface AddToCartRef {
  ...
  (dc: DataConnect, vars: AddToCartVariables): MutationRef<AddToCartData, AddToCartVariables>;
}
export const addToCartRef: AddToCartRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addToCartRef:
```typescript
const name = addToCartRef.operationName;
console.log(name);
```

### Variables
The `AddToCart` mutation requires an argument of type `AddToCartVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddToCartVariables {
  cartId: UUIDString;
  productId: UUIDString;
  quantity: number;
}
```
### Return Type
Recall that executing the `AddToCart` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddToCartData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddToCartData {
  cartItem_insert: CartItem_Key;
}
```
### Using `AddToCart`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addToCart, AddToCartVariables } from '@dataconnect/generated';

// The `AddToCart` mutation requires an argument of type `AddToCartVariables`:
const addToCartVars: AddToCartVariables = {
  cartId: ..., 
  productId: ..., 
  quantity: ..., 
};

// Call the `addToCart()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addToCart(addToCartVars);
// Variables can be defined inline as well.
const { data } = await addToCart({ cartId: ..., productId: ..., quantity: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addToCart(dataConnect, addToCartVars);

console.log(data.cartItem_insert);

// Or, you can use the `Promise` API.
addToCart(addToCartVars).then((response) => {
  const data = response.data;
  console.log(data.cartItem_insert);
});
```

### Using `AddToCart`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addToCartRef, AddToCartVariables } from '@dataconnect/generated';

// The `AddToCart` mutation requires an argument of type `AddToCartVariables`:
const addToCartVars: AddToCartVariables = {
  cartId: ..., 
  productId: ..., 
  quantity: ..., 
};

// Call the `addToCartRef()` function to get a reference to the mutation.
const ref = addToCartRef(addToCartVars);
// Variables can be defined inline as well.
const ref = addToCartRef({ cartId: ..., productId: ..., quantity: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addToCartRef(dataConnect, addToCartVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.cartItem_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.cartItem_insert);
});
```

