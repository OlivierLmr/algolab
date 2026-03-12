export function DslDocs() {
  return (
    <details class="dsl-docs">
      <summary class="dsl-docs-summary">DSL Reference</summary>
      <div class="dsl-docs-columns">
        <div class="dsl-docs-col">
          <h4 class="dsl-docs-heading">Language</h4>
          <table class="dsl-docs-table">
            <tr><td><code>algo Name(arr: int[])</code></td><td>Algorithm entry point</td></tr>
            <tr><td><code>let x = expr</code></td><td>Declare a variable</td></tr>
            <tr><td><code>x = expr</code></td><td>Assign to variable</td></tr>
            <tr><td><code>arr[i] = expr</code></td><td>Assign to array element</td></tr>
            <tr><td><code>for i from a to b</code></td><td>For loop (inclusive bounds)</td></tr>
            <tr><td><code>while condition</code></td><td>While loop</td></tr>
            <tr><td><code>if cond</code> / <code>else</code></td><td>Conditional branch</td></tr>
            <tr><td><code>swap arr[i], arr[j]</code></td><td>Swap two array elements</td></tr>
            <tr><td><code>alloc name size</code></td><td>Allocate a new array</td></tr>
            <tr><td><code>def fn(params)</code></td><td>Define a function</td></tr>
            <tr><td><code>return expr</code></td><td>Return from function</td></tr>
            <tr><td><code>len(arr)</code></td><td>Get array length</td></tr>
            <tr><td><code>inf</code></td><td>Infinity value</td></tr>
            <tr><td colspan={2} class="dsl-docs-operators">Operators: <code>+ - * / % &lt; &gt; &lt;= &gt;= == != and or not</code></td></tr>
          </table>
        </div>
        <div class="dsl-docs-col">
          <h4 class="dsl-docs-heading">Directives <code class="dsl-docs-prefix">#:</code></h4>
          <table class="dsl-docs-table">
            <tr><td><code>comment "text"</code></td><td>Set step description</td></tr>
            <tr><td><code>comment "&#123;expr&#125;"</code></td><td>Interpolate expression in text</td></tr>
            <tr><td><code>comment "&#123;x ? 'a' : 'b'&#125;"</code></td><td>Conditional text</td></tr>
            <tr><td><code>pointer lbl on arr at expr</code></td><td>Show pointer arrow on array</td></tr>
            <tr><td><code>dim arr from i to j</code></td><td>Gray out array range</td></tr>
            <tr><td><code>undim arr from i to j</code></td><td>Restore grayed-out range</td></tr>
          </table>
          <p class="dsl-docs-note">
            Directives are prefixed with <code>#:</code> and control
            visualization without affecting algorithm logic.
          </p>
        </div>
      </div>
    </details>
  )
}
