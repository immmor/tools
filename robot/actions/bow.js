// Action: bow (pose). Registers in window.RobotActions['bow'].
window.RobotActions = window.RobotActions || {};

window.RobotActions.bow = {
    duration: Math.PI * 1.2,
    dynamic: false,
    update(ctx) {
        const { t, bones } = ctx;
        const { torsoGroup, headGroup, leftArm, rightArm } = bones;
        const ease = Math.sin(Math.PI * t);
        const bowAmount = ease * 0.9;
        torsoGroup.rotation.x = bowAmount;
        headGroup.rotation.x = bowAmount * 0.5;
        leftArm.shoulderPivot.rotation.x = -0.3 * bowAmount;
        rightArm.shoulderPivot.rotation.x = -0.3 * bowAmount;
    }
};
