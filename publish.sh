#!/bin/bash
git add -A
git commit -m "$1"
npm run build
git subtree push --prefix public origin gh-pages