# TapShift

This repo contians an offline-first app to track working hours and display important statistics, such as the current balance between due hours and workings hours respecting public holiday, sick days, child-sick, automatic break subtraction based on the rules of germany (primary market target).

## Overview

This repo contains the code for the backend (`./backend`: fastify 11, typeorm 0.3), frontend (`./frontend`: svelte 5, tailwind 4, typescript 4, vite 7), and important functional code and datatypes in (`./lib`: typescript 5, dayjs 1.11). The whole app is in development, so all migrations and refactorings should be done inplace. As a database postgresql 16 is used and provided as a docker container.

The data is shared only over `GET: <data_type>/sync?since=2025-11-01T10:00:00Z` and `POST: <data_type>/sync` endpoints that compare the updated_at field and check whether the currently stored data in the backend is older than the pushed one. on conflicts the frontend gets notified and clears the conflict.

All datatypes are shared in the `./lib/types` folder. The main difference between the frontend and backend is that the backend (relational database) has taregets and targetspecs that are linked through foreign keys. the frontend just receives a target with a list of targetspecs in it.

The calculation of balances is documented in `./docs/balances.md`

## Coding

- for the frontend always use the svelte 5 api
- reduce duplicate code as much as possible
- shared code between frontend and backend is written in ./lib
- always check if all tests are working after changing anything
- to run npm on mac use `export PATH="/opt/homebrew/bin:$PATH"`
