#!/bin/sh
# Photos du catalogue de démonstration (dummyjson.com, Wikimedia Commons) : non versionnées, téléchargées à la demande.
set -e
mkdir -p public && cd public
J=https://cdn.dummyjson.com/product-images/mens-shoes/nike-air-jordan-1-red-and-black
P=https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro
curl -sSLo jordan.webp $J/1.webp; curl -sSLo jordan3.webp $J/3.webp
curl -sSLo iphone.webp $P/1.webp; curl -sSLo iphone2.webp $P/2.webp; curl -sSLo iphone3.webp $P/3.webp
curl -sSLo miel.jpg "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Antiguan_honey_products_at_an_exhibition_in_Saint_Lucia.jpg/960px-Antiguan_honey_products_at_an_exhibition_in_Saint_Lucia.jpg"
