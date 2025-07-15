#!/bin/bash

kubectl delete -f configs/management/management.yaml
curl http://127.0.0.1:8085
kubectl apply -f configs/management/management.yaml
sleep 5
kubectl port-forward -n default svc/management-service 8085:80 &

