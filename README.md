![Build Status](https://github.com/c4dt/service-stainless/actions/workflows/build.yml/badge.svg)

# Stainless-ByzCoin Demonstrator

Steps to run locally:

You first need to generate the node's configs
```
make configs
```

If you want our prebuilt images
```
docker-compose pull
```
Else if you want to build the images yourself
```
make webapp-proto
docker-compose build
```

Launch it with
```
docker-compose up
```

And open a browser to http://localhost:80/stainless-demo/
