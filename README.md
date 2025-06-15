# Battery Dispatch Lab

[Live demo](https://alexsergeev1.github.io/battery-dispatch-lab/)

Optimize hourly battery trades under power, energy, efficiency, wear and availability limits. Compare receding-horizon dispatch with a price rule and a hindsight upper bound on 64 paired synthetic scenarios.

The solver uses backward dynamic programming over 0.25 MWh states. Forecast decisions see the current price and derating, then use a regime baseline and a decaying price residual. Every strategy starts at half capacity and uses the same terminal inventory valuation.

```sh
node --test
node serve.mjs
```

Open http://localhost:8080. Scenario and benchmark tables export to CSV. Prices and outcomes are simulated.
