#!/bin/bash

docker build -t osirisguitar/nexttrain:$1 .
docker push osirisguitar/nexttrain:$1
