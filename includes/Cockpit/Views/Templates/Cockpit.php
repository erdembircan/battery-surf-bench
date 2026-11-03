<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitView}: the cockpit block: the control deck, the surf stage, the run-summary overlay and the toast.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `wrapper` (pre-escaped markup),
 *       `context` (pre-escaped markup), `brand_title` (text), `brand_subtitle`
 *       (text), `compact_label` (attribute value), `sound_label` (attribute
 *       value), `mode_label` (attribute value and text), `duration_mode` (text),
 *       `target_drop_mode` (text), `duration_label` (text), `decrease_label`
 *       (attribute value), `odometer_cells` (pre-escaped markup),
 *       `minutes_label` (text), `increase_label` (attribute value),
 *       `target_label` (text), `target_aria` (attribute value), `surfer_field`
 *       (pre-escaped markup), `speed_label` (attribute value and text),
 *       `status_head` (pre-escaped markup), `pill_body` (pre-escaped markup),
 *       `start_label` (text), `stop_label` (text), `plugged_label` (text),
 *       `expand_label` (attribute value), `idle_card` (pre-escaped markup),
 *       `viewport_title` (attribute value), `summary` (pre-escaped markup),
 *       `toast_dismiss_label` (attribute value).
 */

defined( 'ABSPATH' ) || exit;
?>
<div <?php echo $args['wrapper']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by get_block_wrapper_attributes(). ?> data-wp-interactive="bsb/cockpit" <?php echo $args['context']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by wp_interactivity_data_wp_context(). ?> data-wp-init---battery="callbacks.initBattery" data-wp-init---wake-lock="callbacks.initWakeLock" data-wp-init---sound="callbacks.initSound" data-wp-init---page-advance="callbacks.initPageAdvance" data-wp-init---exit-guard="callbacks.initExitGuard" data-wp-init---bark="callbacks.initBark" data-wp-init---shark="callbacks.initShark" data-wp-watch---run-activity="callbacks.syncRunActivity" data-wp-watch---viewport-watchdog="callbacks.syncViewportWatchdog" data-wp-watch---devtools-battery="callbacks.syncBatteryOverride" data-wp-watch---devtools-surf="callbacks.syncDevtoolsSurf" data-wp-watch---shark-compact="callbacks.syncSharkCompact" data-wp-watch---devtools-shark="callbacks.syncDevtoolsShark" data-wp-class--is-compact="state.isCompact" data-wp-class--is-deck-shown="state.isDeckShown">
	<aside class="bsb-cockpit__deck">
		<header class="bsb-deck__brand">
			<span class="bsb-deck__mark" aria-hidden="true"></span>
			<span class="bsb-deck__title"><?php echo esc_html( $args['brand_title'] ); ?></span>
			<span class="bsb-deck__subtitle"><?php echo esc_html( $args['brand_subtitle'] ); ?></span>
			<span class="bsb-deck__actions">
				<button type="button" class="bsb-deck__compact" data-wp-on--click="actions.toggleCompact" data-wp-class--is-hidden="state.isIdle" aria-label="<?php echo esc_attr( $args['compact_label'] ); ?>"></button>
				<button type="button" class="bsb-deck__sound" data-wp-on--click="actions.toggleSound" data-wp-class--is-on="state.isSoundOn" data-wp-bind--aria-pressed="state.isSoundOn" aria-label="<?php echo esc_attr( $args['sound_label'] ); ?>"></button>
			</span>
		</header>

		<div class="bsb-deck__body">
			<div class="bsb-deck__swap" data-wp-class--is-running="state.isRunning">
			<div class="bsb-deck__config">
			<section class="bsb-field">
				<span class="bsb-field__label"><?php echo esc_html( $args['mode_label'] ); ?></span>
				<div class="bsb-seg" role="group" aria-label="<?php echo esc_attr( $args['mode_label'] ); ?>">
					<button type="button" class="bsb-seg__option" data-mode="duration" data-wp-on--click="actions.selectMode" data-wp-class--is-active="state.isModeDuration" data-wp-bind--aria-pressed="state.isModeDuration"><?php echo esc_html( $args['duration_mode'] ); ?></button>
					<button type="button" class="bsb-seg__option" data-mode="targetDrop" data-wp-on--click="actions.selectMode" data-wp-class--is-active="state.isModeTargetDrop" data-wp-bind--aria-pressed="state.isModeTargetDrop"><?php echo esc_html( $args['target_drop_mode'] ); ?></button>
				</div>
			</section>

			<section class="bsb-field bsb-field--duration" data-wp-bind--hidden="state.isModeTargetDrop">
				<span class="bsb-field__label"><?php echo esc_html( $args['duration_label'] ); ?></span>
				<div class="bsb-stepper">
					<button type="button" class="bsb-stepper__btn" data-step="-5" data-wp-on--click="actions.stepDuration" aria-label="<?php echo esc_attr( $args['decrease_label'] ); ?>">&minus;</button>
					<span class="bsb-stepper__readout">
						<span class="bsb-odometer" data-wp-watch="callbacks.rollDuration" aria-hidden="true">
							<span class="bsb-odometer__wheel bsb-odometer__wheel--lead is-collapsed"><span class="bsb-odometer__strip"><?php echo $args['odometer_cells']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?></span></span>
							<span class="bsb-odometer__wheel bsb-odometer__wheel--lead is-collapsed"><span class="bsb-odometer__strip"><?php echo $args['odometer_cells']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?></span></span>
							<span class="bsb-odometer__wheel"><span class="bsb-odometer__strip"><?php echo $args['odometer_cells']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?></span></span>
						</span>
						<span class="bsb-stepper__sr" data-wp-text="state.durationDisplay"></span>
						<span class="bsb-stepper__unit"><?php echo esc_html( $args['minutes_label'] ); ?></span>
					</span>
					<button type="button" class="bsb-stepper__btn" data-step="5" data-wp-on--click="actions.stepDuration" aria-label="<?php echo esc_attr( $args['increase_label'] ); ?>">+</button>
				</div>
			</section>

			<section class="bsb-field bsb-field--target" hidden data-wp-bind--hidden="state.isModeDuration">
				<span class="bsb-field__label"><?php echo esc_html( $args['target_label'] ); ?></span>
				<div class="bsb-target">
					<span class="bsb-target__gauge">
						<span class="bsb-target__battery" role="slider" tabindex="0" aria-valuemin="5" data-wp-bind--aria-valuemax="state.targetCap" aria-label="<?php echo esc_attr( $args['target_aria'] ); ?>" data-wp-bind--aria-valuenow="context.targetPercent" data-wp-bind--aria-valuetext="state.targetDisplay" data-wp-on--pointerdown="actions.targetPointerDown" data-wp-on--pointermove="actions.targetPointerMove" data-wp-on--pointerup="actions.targetPointerUp" data-wp-on--keydown="actions.targetKeyDown">
							<span class="bsb-target__fill" data-wp-style--width="state.targetDisplay" data-wp-style--background="state.targetColor"></span>
							<span class="bsb-target__handle" data-wp-style--left="state.targetDisplay"></span>
						</span>
						<span class="bsb-target__cap" aria-hidden="true"></span>
					</span>
					<span class="bsb-target__value" data-wp-text="state.targetDisplay" data-wp-style--color="state.targetColor"></span>
				</div>
			</section>

			<?php echo $args['surfer_field']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>


			<section class="bsb-field">
				<span class="bsb-field__label"><?php echo esc_html( $args['speed_label'] ); ?></span>
				<div class="bsb-seg bsb-seg--speed" role="group" aria-label="<?php echo esc_attr( $args['speed_label'] ); ?>">
					<button type="button" class="bsb-seg__option" data-speed="1" data-wp-on--click="actions.selectSpeed" data-wp-class--is-active="state.isSpeed1" data-wp-bind--aria-pressed="state.isSpeed1">1&times;</button>
					<button type="button" class="bsb-seg__option" data-speed="4" data-wp-on--click="actions.selectSpeed" data-wp-class--is-active="state.isSpeed4" data-wp-bind--aria-pressed="state.isSpeed4">4&times;</button>
					<button type="button" class="bsb-seg__option" data-speed="10" data-wp-on--click="actions.selectSpeed" data-wp-class--is-active="state.isSpeed10" data-wp-bind--aria-pressed="state.isSpeed10">10&times;</button>
				</div>
			</section>
			</div>

			<div class="bsb-deck__status">
			<?php echo $args['status_head']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

			<?php echo $args['pill_body']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

			</div>
			</div>
		</div>

		<footer class="bsb-deck__foot">
			<button type="button" class="bsb-run" data-wp-on--click="actions.toggleRun" data-wp-class--is-running="state.isRunning" data-wp-class--is-blocked="state.isStartBlocked" data-wp-bind--disabled="state.isStartBlocked">
				<span class="bsb-run__glyph" aria-hidden="true"></span>
				<span class="bsb-run__text bsb-run__text--start"><?php echo esc_html( $args['start_label'] ); ?></span>
				<span class="bsb-run__text bsb-run__text--stop"><?php echo esc_html( $args['stop_label'] ); ?></span>
				<span class="bsb-run__text bsb-run__text--blocked"><?php echo esc_html( $args['plugged_label'] ); ?></span>
			</button>
		</footer>
	</aside>

	<div class="bsb-cockpit__stage">
		<div class="bsb-cockpit__topbar">
			<div class="bsb-deck__status">
				<div class="bsb-cockpit__lockup">
					<span class="bsb-cockpit__brandmark"><?php echo esc_html( $args['brand_title'] ); ?></span>
				<?php echo $args['status_head']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

				</div>
			<?php echo $args['pill_body']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

				<div class="bsb-deck__readout-ctrl">
					<button type="button" class="bsb-deck__readout-stop" data-wp-on--click="actions.toggleRun"><?php echo esc_html( $args['stop_label'] ); ?></button>
					<button type="button" class="bsb-deck__expand" data-wp-on--click="actions.toggleCompact" aria-label="<?php echo esc_attr( $args['expand_label'] ); ?>"></button>
					<button type="button" class="bsb-deck__readout-sound" data-wp-on--click="actions.toggleSound" data-wp-class--is-on="state.isSoundOn" data-wp-bind--aria-pressed="state.isSoundOn" aria-label="<?php echo esc_attr( $args['sound_label'] ); ?>"></button>
				</div>
			</div>
		</div>
		<div class="bsb-cockpit__idle" data-wp-bind--hidden="state.isRunning">
			<?php echo $args['idle_card']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

		</div>
		<div class="bsb-cockpit__viewport-wrap" hidden data-wp-bind--hidden="state.isIdle" data-wp-on--pointerenter="actions.viewportEnter">
			<iframe class="bsb-cockpit__viewport" title="<?php echo esc_attr( $args['viewport_title'] ); ?>" data-wp-bind--src="state.currentSrc" data-wp-on--load="actions.guardViewport" data-wp-on--error="actions.guardViewport"></iframe>
			<div class="bsb-cockpit__bark-layer" aria-hidden="true">
				<div class="bsb-cockpit__bark" hidden data-wp-bind--hidden="!state.hasBark" data-wp-bind--data-bark="state.barkKey" data-wp-class--is-entering="state.isBarkEntering" data-wp-class--is-leaving="state.isBarkLeaving">
					<span class="bsb-cockpit__bark-tide" aria-hidden="true" data-wp-style----bark-dur="state.barkDurationCss" data-wp-style----bark-ebb-name="state.barkEbbName" data-wp-style----bsb-wave-speed="context.speed">
						<span class="bsb-cockpit__bark-tide-wave bsb-cockpit__bark-tide-wave--back" aria-hidden="true"></span>
						<span class="bsb-cockpit__bark-tide-wave bsb-cockpit__bark-tide-wave--mid" aria-hidden="true"></span>
						<span class="bsb-cockpit__bark-tide-wave bsb-cockpit__bark-tide-wave--front" aria-hidden="true"></span>
					</span>
					<span class="bsb-cockpit__bark-icon" aria-hidden="true"></span>
					<span class="bsb-cockpit__bark-msg" data-wp-text="state.barkMessage"></span>
				</div>
			</div>
			<div class="bsb-cockpit__shield" aria-hidden="true"></div>
		</div>
	</div>

	<?php echo $args['summary']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>


	<div class="bsb-cockpit__toast-layer">
		<div class="bsb-cockpit__toast" hidden role="status" data-wp-bind--hidden="!state.hasToast" data-wp-bind--role="state.toastRole" data-wp-class--is-error="state.isToastError" data-wp-class--is-notice="state.isToastNotice" data-wp-class--is-entering="state.isToastEntering" data-wp-class--is-holding="state.isToastHolding" data-wp-class--is-leaving="state.isToastLeaving" data-wp-on--animationend="callbacks.onToastAnimationEnd">
			<span class="bsb-cockpit__toast-icon" aria-hidden="true"></span>
			<span class="bsb-cockpit__toast-msg" data-wp-text="state.toastMessage"></span>
			<button type="button" class="bsb-cockpit__toast-close" data-wp-on--click="actions.dismissToast" aria-label="<?php echo esc_attr( $args['toast_dismiss_label'] ); ?>"></button>
		</div>
	</div>
</div>
