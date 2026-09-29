import pandas as pd
import json
from vertexai.preview.evaluation import EvalTask
from vertexai.preview.evaluation.metrics import PointwiseMetric, PointwiseMetricPromptTemplate

# 1. Define the BYOD / Golden Dataset DataFrame
eval_data = {
    "prompt": [
        "Get the train price to Kyoto and convert my $800 USD budget.",
        "Get live weather for Paris and translate 'Hello'."
    ],
    "reference_trajectory": [
        json.dumps([
            {"tool_name": "query_tourism_graph", "tool_input": {"question": "Tokyo to Kyoto train"}}, 
            {"tool_name": "live_currency_conversion"}
        ]),
        json.dumps([
            {"tool_name": "get_live_weather"},
            {"tool_name": "translate_text"}
        ])
    ],
    "predicted_trajectory": [  # Captured from our TrajectoryTracker in Production
        json.dumps([
            {"tool_name": "query_tourism_graph", "tool_input": {"question": "Tokyo to Kyoto train"}}, 
            {"tool_name": "live_currency_conversion"}
        ]),
        json.dumps([
            {"tool_name": "get_live_weather"},
            {"tool_name": "translate_text"}
        ])
    ],
    "response": [
        "The ticket is 100 USD. Your budget is 128,000 JPY.",
        "It is 18C in Paris. Translation: Bonjour."
    ]
}
eval_df = pd.DataFrame(eval_data)

# 2. Define a Custom Pointwise Metric (LLM-as-a-Judge Rubric)
criteria = {
    "Follows trajectory": (
        "Evaluate whether the agent's response logically follows from the sequence of tool actions.\\n"
        "  - Does the response accurately reflect the data gathered from the tools without hallucination?\\n"
        "  - Are there any illogical jumps in reasoning?"
    )
}
pointwise_rating_rubric = {
    "1": "Response perfectly reflects information gathered in the trajectory.",
    "0": "Response contains hallucinated data or illogical jumps."
}

trajectory_faithfulness_prompt = PointwiseMetricPromptTemplate(
    criteria=criteria,
    rating_rubric=pointwise_rating_rubric,
    input_variables=["prompt", "predicted_trajectory"]
)
faithfulness_metric = PointwiseMetric(
    metric="response_follows_trajectory",
    metric_prompt_template=trajectory_faithfulness_prompt
)

# 3. Combine with Native SDK Trajectory Metrics
metrics_to_run = [
    "trajectory_exact_match",       # Did it follow the DAG perfectly?
    "trajectory_any_order_match",   # Did it hit all required APIs?
    "safety",                       # Is the text output safe?
    faithfulness_metric             # Custom LLM-as-a-Judge rubric defined above
]

# 4. Execute the Scalable EvalTask
try:
    eval_task = EvalTask(
        dataset=eval_df,
        metrics=metrics_to_run,
        experiment="tourism-swarm-eval-pipeline"
    )

    # Run the evaluation against the BYOD dataset
    eval_result = eval_task.evaluate()
    print("📊 Final Swarm Evaluation Summary:")
    print(eval_result.summary_metrics)
except Exception as e:
    print(f"Error during execution: {e}")
    print("Por favor verifica que tienes autenticación en Google Cloud (gcloud auth application-default login) y un proyecto de Vertex AI configurado.")
