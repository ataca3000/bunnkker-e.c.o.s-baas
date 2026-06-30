# React Canvas Magnetic Inspector

A lightweight, conceptual boilerplate for building "Shopify/Canva" style page builders in React.

## What is it?
Extracts the core logic of selecting DOM elements inside an iframe or preview canvas, and feeding their properties to a side-panel "Inspector".

## How it works
1. Wraps standard HTML/React blocks with a `MagneticBlock` component.
2. Clicking a block triggers an `onSelect` event, passing the block's current styles to the `Inspector` state.
3. Modifying sliders in the Inspector updates the state, reflecting "Live" on the canvas.

## License
MIT - Created by Brecha Soluciones S.A. de C.V.
